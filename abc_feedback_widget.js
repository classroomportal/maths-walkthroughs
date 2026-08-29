// ABC Maths — Progress Tracking Widget

(function() {
  const SUPABASE_URL  = 'https://lnwinoghbefmjpvmixzo.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud2lub2doYmVmbWpwdm1peHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIxNzQsImV4cCI6MjA5Nzk1ODE3NH0.ubKHVLrxlxQd-w3n5pS3O6YMAI7I--ndEkI2xWM9qCo';

  let _cachedTopicId  = null;
  let _cachedSchoolId = null;
  const _loggedQuestions = new Set();
  const _pageOpenedAt = Date.now();

  // Don't rely on the host page having set window._supabase — some
  // walkthrough files create their Supabase client as a page-local const
  // and never expose it globally, which silently breaks getSession() here.
  // Create our own client lazily (and reuse window._supabase if present).
  let _clientPromise = null;
  function getClient() {
    if (window._supabase) return Promise.resolve(window._supabase);
    if (!_clientPromise) {
      _clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')
        .then(function(mod) {
          const c = mod.createClient(SUPABASE_URL, SUPABASE_ANON);
          window._supabase = c;
          return c;
        })
        .catch(function(e) { console.error('supabase client init failed:', e); return null; });
    }
    return _clientPromise;
  }

  async function getSession() {
    try {
      const client = await getClient();
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        return session;
      }
    } catch(e) {}
    return null;
  }

  async function getTopicId(session) {
    if (_cachedTopicId) return _cachedTopicId;
    const topicCode = window._abcTopicCode;
    if (!topicCode) return null;
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/topics?topic_code=eq.${topicCode}&select=id`,
        { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${session ? session.access_token : SUPABASE_ANON}` } }
      );
      const rows = await resp.json();
      if (rows && rows.length) {
        _cachedTopicId = rows[0].id;
        window._abcTopicId = rows[0].id;
      }
    } catch(e) { console.error('topic lookup failed:', e); }
    return _cachedTopicId;
  }

  async function getSchoolId(session) {
    if (_cachedSchoolId) return _cachedSchoolId;
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=school_id`,
        { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${session.access_token}` } }
      );
      const rows = await resp.json();
      if (rows && rows.length) _cachedSchoolId = rows[0].school_id;
    } catch(e) { console.error('school_id lookup failed:', e); }
    return _cachedSchoolId;
  }

  // Log that the student genuinely reached a given question (1-10). The
  // server records its own timestamp for each row — client-side time is
  // never trusted — so mark_walkthrough_complete() can verify real pacing.
  async function logInteraction(questionIndex) {
    if (questionIndex < 1 || questionIndex > 10) return;
    if (_loggedQuestions.has(questionIndex)) return;
    _loggedQuestions.add(questionIndex);
    try {
      const session = await getSession();
      if (!session) return;
      const [topicId, schoolId] = await Promise.all([getTopicId(session), getSchoolId(session)]);
      if (!topicId || !schoolId) return;
      await fetch(`${SUPABASE_URL}/rest/v1/walkthrough_interactions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          student_id:     session.user.id,
          topic_id:       topicId,
          school_id:      schoolId,
          question_index: questionIndex
        })
      });
    } catch(e) { console.error('interaction log failed:', e); }
  }

  // Every 2 seconds: if this page has a real per-question index (window.qi,
  // used by the standard 10-question walkthrough template), log genuine
  // progress through it. If not (a small number of simpler pages don't have
  // this structure), fall back to a time-based heartbeat so completion
  // still requires a sensible minimum time actually spent on the page.
  setInterval(function() {
    if (typeof window.qi === 'number') {
      logInteraction(window.qi + 1);
    } else {
      const secondsOpen = Math.floor((Date.now() - _pageOpenedAt) / 1000);
      const bucket = Math.min(10, Math.floor(secondsOpen / 6) + 1);
      logInteraction(bucket);
    }
  }, 2000);

  // Check for recently fixed bugs and show banner
  async function checkRecentFix() {
    const topicCode = window._abcTopicCode;
    if (!topicCode) return;
    try {
      const session = await getSession();
      const topicId = await getTopicId(session);
      if (!topicId) return;

      const authToken = session ? session.access_token : SUPABASE_ANON;
      const url = SUPABASE_URL + '/rest/v1/bug_reports?status=eq.fixed&topic_id=eq.' + topicId + '&limit=1';
      const bugResp = await fetch(url,
        { headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + authToken } }
      );
      const bugs = await bugResp.json();
      if (bugs && bugs.length > 0) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#e8f0fe;border-left:4px solid #1a56b0;padding:10px 16px;font-size:0.85rem;color:#1a56b0;font-family:Segoe UI,Arial,sans-serif;margin-bottom:8px;';
        banner.innerHTML = '🔧 <strong>Recently updated</strong> — This walkthrough was improved following a student report.';
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } catch(e) { console.error('Banner error:', e.message, e); }
  }

  // Wait for topic code to be set by module script, then check
  function waitForTopicCode(attempts) {
    if (window._abcTopicCode) {
      checkRecentFix();
    } else if (attempts > 0) {
      setTimeout(function() { waitForTopicCode(attempts - 1); }, 200);
    }
  }
  document.addEventListener('DOMContentLoaded', function() { waitForTopicCode(10); });

  // Capture JS errors automatically
  const _jsErrors = [];
  window.addEventListener('error', function(e) {
    _jsErrors.push(e.message + ' (' + e.filename?.split('/').pop() + ':' + e.lineno + ')');
  });

  const style = document.createElement('style');
  style.textContent = `
    #abc-complete-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: white; border-top: 2px solid #eee;
      padding: 10px 24px; display: flex; align-items: center;
      justify-content: center; gap: 16px; z-index: 999;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.08); flex-wrap: wrap;
    }
    #abc-complete-btn {
      background: #C0272D; color: white; border: none;
      border-radius: 6px; padding: 9px 24px; font-size: 0.9rem;
      font-weight: 700; cursor: pointer; font-family: inherit;
    }
    #abc-complete-btn:hover { background: #a01f24; }
    #abc-complete-btn:disabled { background: #ccc; cursor: not-allowed; }
    #abc-complete-done { color: #2e7d32; font-weight: 600; font-size: 0.9rem; display: none; }
    #abc-dashboard-link { display: none; font-size: 0.85rem; color: #C0272D; font-weight: 600; text-decoration: none; }
    #abc-dashboard-link:hover { text-decoration: underline; }

    body { padding-bottom: 70px; }
  `;
  document.head.appendChild(style);

  // ── Bottom bar ──
  const bar = document.createElement('div');
  bar.id = 'abc-complete-bar';
  bar.innerHTML = `
    <button id="abc-complete-btn" onclick="abcMarkComplete()">✓ Mark as Complete</button>
    <div id="abc-complete-done">✓ Topic marked as complete!</div>
    <a id="abc-dashboard-link" href="../dashboard-student.html">← Back to My Dashboard</a>
  `;
  document.body.appendChild(bar);

  window.abcMarkComplete = async function() {
    const btn = document.getElementById('abc-complete-btn');
    btn.disabled = true;
    btn.textContent = 'Checking…';

    try {
      const session = await getSession();
      if (!session) {
        btn.disabled = false;
        btn.textContent = '✓ Mark as Complete';
        alert('Please log in to track your progress.');
        return;
      }

      const topicCode = window._abcTopicCode;
      if (!topicCode) { btn.disabled = false; btn.textContent = '✓ Mark as Complete'; return; }

      // The server independently verifies genuine engagement (all 10
      // questions reached, sensibly paced) before allowing this to succeed —
      // the client cannot set status='completed' directly any more.
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_walkthrough_complete`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_topic_code: topicCode })
      });

      if (!resp.ok) {
        let msg = '';
        try { const errBody = await resp.json(); msg = errBody.message || ''; } catch(e) {}
        btn.disabled = false;
        btn.textContent = '✓ Mark as Complete';
        if (/of 10 questions|too quickly/i.test(msg)) {
          alert("Looks like you haven't worked through the whole topic yet. Please review each question, then try again.");
        } else {
          alert('Sorry, something went wrong saving your progress. Please try again.');
        }
        return;
      }

      btn.style.display = 'none';
      document.getElementById('abc-complete-done').style.display  = 'block';
      document.getElementById('abc-dashboard-link').style.display = 'inline';

    } catch(e) {
      console.error('Complete error:', e);
      btn.disabled = false;
      btn.textContent = '✓ Mark as Complete';
    }
  };

})();
