(() => {
  const form = document.querySelector('#search-form');
  const majorInput = document.querySelector('#major');
  const checkButton = document.querySelector('#check-button');
  const answer = document.querySelector('#answer');
  const status = document.querySelector('#status');
  const saveNote = document.querySelector('#save-note');
  const storage = window.collegeStorage;

  const saved = storage.loadLastSearch();
  if (saved) {
    majorInput.value = saved.major || '';
    document.querySelector('#state').value = saved.filters?.state || 'Any';
    document.querySelector('#cost').value = saved.filters?.cost || 'Any';
    document.querySelector('#size').value = saved.filters?.size || 'Any';
    saveNote.textContent = 'Your last search is saved on this computer only for now.';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const major = majorInput.value.trim();
    if (!major) return;

    const filters = {
      state: document.querySelector('#state').value,
      cost: document.querySelector('#cost').value,
      size: document.querySelector('#size').value,
    };
    storage.saveLastSearch({ major, filters });
    saveNote.textContent = 'Saves on this computer only for now.';
    checkButton.disabled = true;
    checkButton.textContent = 'Thinking…';
    status.textContent = 'Thinking…';
    answer.innerHTML = '';

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ major, filters }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Please check the internet and try again.');
      status.textContent = '';
      answer.innerHTML = renderAnswer(body.answer);
    } catch (error) {
      status.textContent = '';
      answer.innerHTML = `<div class="error-state"><h2>We couldn’t finish that search.</h2><p>${escapeHtml(error.message)}</p><button class="secondary" type="button" id="try-again">Try again</button></div>`;
      document.querySelector('#try-again').addEventListener('click', () => form.requestSubmit());
    } finally {
      checkButton.disabled = false;
      checkButton.textContent = 'Check';
    }
  });

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function renderAnswer(rawAnswer) {
    const parsed = parseJsonAnswer(rawAnswer);
    if (!parsed || !Array.isArray(parsed.colleges)) {
      return `<div class="answer-content"><p class="eyebrow">Recommended matches</p><div class="ai-answer">${escapeHtml(rawAnswer)}</div><p class="disclaimer">Check each program on its official college website before making a decision.</p></div>`;
    }

    const cards = parsed.colleges.slice(0, 3).map((college) => `
      <article class="college-card">
        <p class="card-label">Recommended match</p>
        <h3>${escapeHtml(college.name || 'College option')}</h3>
        <p class="college-meta">${escapeHtml(college.location || 'Location needs checking')}</p>
        <ul>
          ${[college.major && `Major/program: ${college.major}`, college.cost && `Cost: ${college.cost}`, college.size && `Size: ${college.size}`, ...(Array.isArray(college.bullets) ? college.bullets : [])].filter(Boolean).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
        </ul>
        ${college.officialUrl ? `<a href="${safeUrl(college.officialUrl)}" target="_blank" rel="noreferrer">Check official college website ↗</a>` : '<span class="needs-checking">Official link needs checking</span>'}
      </article>`).join('');

    return `<div class="answer-content"><p class="eyebrow">Recommended matches</p><h2>Compare colleges side by side</h2><p class="answer-summary">${escapeHtml(parsed.summary || 'These matches are based on your major and filters.')}</p><div class="college-grid">${cards}</div><p class="disclaimer">Check each program on its official college website before making a decision.</p></div>`;
  }

  function parseJsonAnswer(rawAnswer) {
    try {
      const cleaned = String(rawAnswer).trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? escapeHtml(parsed.href) : '#';
    } catch {
      return '#';
    }
  }
})();
