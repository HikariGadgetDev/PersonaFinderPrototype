// ==========================================
// function.js - 認知機能詳細ページ V2
// （新JSON構造 + クイックチェック対応）
// ==========================================

const params = new URLSearchParams(location.search);
const code = (params.get('code') || params.get('func') || 'ni').toLowerCase();

// ==========================================
// ユーティリティ
// ==========================================

function e(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createElement(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined && content !== null) {
    if (typeof content === 'string') {
      el.textContent = content;
    } else if (Array.isArray(content)) {
      content.forEach(child => el.appendChild(child));
    } else {
      el.appendChild(content);
    }
  }
  return el;
}

/**
 * **〜** → <strong> に変換
 * 空行2つで段落、1つで <br>
 */
function formatTextToElements(str) {
  if (!str) return [];
  const elements = [];
  const paragraphs = String(str).split(/\n\n+/);

  paragraphs.forEach(p => {
    const para = document.createElement('p');
    const lines = p.split('\n');

    lines.forEach((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/g);
      parts.forEach((part, j) => {
        if (!part) return;
        if (j % 2 === 1) {
          const strong = document.createElement('strong');
          strong.textContent = part;
          para.appendChild(strong);
        } else {
          para.appendChild(document.createTextNode(part));
        }
      });

      if (i < lines.length - 1) {
        para.appendChild(document.createElement('br'));
      }
    });

    elements.push(para);
  });

  return elements;
}

function createSection(id, title, icon = '') {
  const section = createElement('section', 'section');
  section.id = id;
  const heading = createElement(
    'h2',
    'section__title',
    `${icon ? icon + ' ' : ''}${title}`
  );
  section.appendChild(heading);
  return section;
}

function createInfoBox(title, content, isWarning = false) {
  const box = createElement('div', isWarning ? 'warning-box' : 'info-box');
  const titleEl = createElement(
    'div',
    isWarning ? 'warning-title' : 'info-title',
    title
  );
  const bodyEl = createElement(
    'div',
    isWarning ? 'warning-content' : 'info-content'
  );
  formatTextToElements(content).forEach(el => bodyEl.appendChild(el));
  box.appendChild(titleEl);
  box.appendChild(bodyEl);
  return box;
}

// ==========================================
// ヒーロー
// ==========================================

function updateHero(data) {
  const funcCode =
    (data.function || data.code || code || '').toUpperCase();
  const name =
    data.name || data.meta?.displayName || '認知機能';

  const tagline =
    data.meta?.summaryTagline ||
    data.short ||
    '認知機能の深層分析';

  const tags =
    data.meta?.tags ||
    data.tags ||
    [];

  const codeEl = document.getElementById('hero-code');
  const nameEl = document.getElementById('hero-name');
  const taglineEl = document.getElementById('hero-tagline');
  const tagsEl = document.getElementById('hero-tags');

  if (codeEl) codeEl.textContent = funcCode;
  if (nameEl) nameEl.textContent = name;
  if (taglineEl) taglineEl.textContent = tagline;

  if (tagsEl) {
    tagsEl.innerHTML = '';
    if (Array.isArray(tags) && tags.length) {
      const frag = document.createDocumentFragment();
      tags.forEach(tag => {
        const span = createElement('span', 'tag', tag);
        frag.appendChild(span);
      });
      tagsEl.appendChild(frag);
    }
  }
}

// ==========================================
// セクションレンダラ
// ==========================================

// 1. ざっくりした姿（short + overview.essence + quickCheck）
function renderIntroSection(data, tocItems, sectionId) {
  const hasOverview =
    data.short || data.overview?.essence || (data.quickCheck && data.quickCheck.length);
  if (!hasOverview) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: 'この認知機能のざっくりした姿' });

  const section = createSection(id, 'この認知機能のざっくりした姿', '📌');

  // リードテキスト
  if (data.short || data.overview?.essence) {
    const lead = createElement('div', 'lead');
    const text = [data.short, data.overview?.essence].filter(Boolean).join('\n\n');
    formatTextToElements(text).forEach(el => lead.appendChild(el));
    section.appendChild(lead);
  }

  // クイックチェック（JSON側で好きなだけ項目増やせる）
  if (Array.isArray(data.quickCheck) && data.quickCheck.length) {
    const quizCard = createElement('div', 'quiz-card');

    const title = createElement('div', 'quiz-title', '簡易チェック');
    const subtitle = createElement(
      'div',
      'quiz-subtitle',
      'あてはまるものにチェックを入れてみてください。'
    );
    quizCard.appendChild(title);
    quizCard.appendChild(subtitle);

    const list = createElement('ul', 'quiz-list');
    const checkboxes = [];

    data.quickCheck.forEach((item, idx) => {
      const li = createElement('li', 'quiz-item');
      const label = createElement('label', 'quiz-label');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'quiz-checkbox';
      checkbox.id = `quiz-q-${idx}`;
      checkboxes.push(checkbox);

      const textSpan = createElement('span', 'quiz-text');
      formatTextToElements(item).forEach(el => {
        while (el.firstChild) textSpan.appendChild(el.firstChild);
      });

      label.htmlFor = checkbox.id;
      label.appendChild(checkbox);
      label.appendChild(textSpan);
      li.appendChild(label);
      list.appendChild(li);
    });

    quizCard.appendChild(list);

    // 結果表示
    const result = createElement('div', 'quiz-result');
    const scoreEl = createElement('div', 'quiz-score', `0/${data.quickCheck.length}`);
    const interpEl = createElement(
      'div',
      'quiz-interpretation',
      'チェック数に応じて、この機能との距離感の目安を表示します。'
    );
    result.appendChild(scoreEl);
    result.appendChild(interpEl);
    quizCard.appendChild(result);

    // 判定ロジック（ざっくり「主機能 / 補助〜第三 / 周辺」）
    const updateResult = () => {
      const total = data.quickCheck.length;
      const checked = checkboxes.filter(cb => cb.checked).length;
      scoreEl.textContent = `${checked}/${total}`;

      let message;

      if (checked === 0) {
        message = 'このページの記述は「そこまで自分っぽくない」と感じるかもしれません。他機能のページも覗いてみてください。';
      } else {
        const ratio = checked / total;

        if (ratio >= 0.7) {
          message = 'この機能を「主機能」または「補助機能」として強く使っている可能性があります。日常の判断や認識の軸になっているかもしれません。';
        } else if (ratio >= 0.4) {
          message = 'この機能は、補助・第三あたりでそこそこ使われている可能性があります。他の機能とのバランスも合わせて見ると、スタックの輪郭が見えやすくなります。';
        } else {
          message = 'この機能は、影響はあるもののメインの軸というより「背景」で働いているかもしれません。別の機能のページにも強く共感する可能性があります。';
        }
      }

      interpEl.textContent = message;
      result.classList.add('quiz-result--visible');
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateResult);
    });

    section.appendChild(quizCard);
  }

  return { fragment: section, sectionId };
}

// 2. この機能が世界をどう見ているか（detailed + mechanism）
function renderInnerViewSection(data, tocItems, sectionId) {
  const hasContent = data.overview?.detailed || data.overview?.mechanism;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: 'この機能が世界をどう見ているか' });

  const section = createSection(id, 'この機能が世界をどう見ているか', '👁️');
  const prose = createElement('div', 'prose');

  if (data.overview?.detailed) {
    const h3 = createElement('h3', null, '内側の視点');
    prose.appendChild(h3);
    formatTextToElements(data.overview.detailed).forEach(el => prose.appendChild(el));
  }

  if (data.overview?.mechanism) {
    const h3 = createElement('h3', null, '働き方のメカニズム');
    prose.appendChild(h3);
    formatTextToElements(data.overview.mechanism).forEach(el => prose.appendChild(el));
  }

  section.appendChild(prose);
  return { fragment: section, sectionId };
}

// 3. 理論上の位置づけ（jungian + comparisons）
function renderTheorySection(data, tocItems, sectionId) {
  const j = data.jungian || {};
  const c = data.comparisons || {};
  const hasContent =
    j.definition || j.orientation || j.purpose ||
    c.similarButDifferent || c.oftenConfusedWith;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: '理論上の位置づけ' });

  const section = createSection(id, '理論上の位置づけと、似ている機能との違い', '📚');
  const prose = createElement('div', 'prose');

  if (j.definition || j.orientation || j.purpose) {
    const h3 = createElement('h3', null, '理論上の位置づけ');
    prose.appendChild(h3);
    [j.definition, j.orientation, j.purpose]
      .filter(Boolean)
      .forEach(text => formatTextToElements(text).forEach(el => prose.appendChild(el)));
  }

  if (c.similarButDifferent || c.oftenConfusedWith) {
    const h3 = createElement('h3', null, '似ている機能との違い');
    prose.appendChild(h3);
    [c.similarButDifferent, c.oftenConfusedWith]
      .filter(Boolean)
      .forEach(text => formatTextToElements(text).forEach(el => prose.appendChild(el)));
  }

  section.appendChild(prose);
  return { fragment: section, sectionId };
}

// 4. タイプの中での現れ方（stackDynamics）
function renderStackSection(data, tocItems, sectionId) {
  const s = data.stackDynamics || {};
  const hasContent = s.dominant || s.auxiliary || s.tertiary || s.inferior;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: 'タイプの中での現れ方' });

  const section = createSection(id, 'タイプの中での現れ方', '🧩');
  const grid = createElement('div', 'types-grid');

  const order = [
    { key: 'dominant', label: 'もっとも前面にあるとき' },
    { key: 'auxiliary', label: '第二の位置にあるとき' },
    { key: 'tertiary', label: '第三の位置にあるとき' },
    { key: 'inferior', label: 'もっとも奥にあるとき' }
  ];

  order.forEach(item => {
    const text = s[item.key];
    if (!text) return;

    const card = createElement('div', 'type-card');
    const title = createElement('div', 'type-card__title', item.label);
    const body = createElement('div', 'type-card__body');

    formatTextToElements(text).forEach(el => body.appendChild(el));
    card.appendChild(title);
    card.appendChild(body);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return { fragment: section, sectionId };
}

// 5. バランスとつまずき（development + misconceptions）
function renderDevelopmentSection(data, tocItems, sectionId) {
  const d = data.development || {};
  const hasContent = d.balanced || d.overuse || d.underuse || data.misconceptions;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: 'バランスとつまずき' });

  const section = createSection(id, 'バランスとつまずきやすいポイント', '⚖️');
  const prose = createElement('div', 'prose');

  if (d.balanced) {
    const h3 = createElement('h3', null, 'バランスよく働いているとき');
    prose.appendChild(h3);
    formatTextToElements(d.balanced).forEach(el => prose.appendChild(el));
  }

  if (d.overuse || d.underuse) {
    const h3 = createElement('h3', null, '偏りやすい方向');
    prose.appendChild(h3);

    if (d.overuse) {
      const p = document.createElement('p');
      const strong = createElement('strong', null, '使いすぎるとき');
      p.appendChild(strong);
      p.appendChild(document.createElement('br'));
      formatTextToElements(d.overuse).forEach(el => {
        while (el.firstChild) p.appendChild(el.firstChild);
      });
      prose.appendChild(p);
    }

    if (d.underuse) {
      const p = document.createElement('p');
      const strong = createElement('strong', null, '避けすぎるとき');
      p.appendChild(strong);
      p.appendChild(document.createElement('br'));
      formatTextToElements(d.underuse).forEach(el => {
        while (el.firstChild) p.appendChild(el.firstChild);
      });
      prose.appendChild(p);
    }
  }

  if (data.misconceptions) {
    const h3 = createElement('h3', null, 'よくある誤解');
    prose.appendChild(h3);
    formatTextToElements(data.misconceptions).forEach(el => prose.appendChild(el));
  }

  section.appendChild(prose);
  return { fragment: section, sectionId };
}

// 6. 影の側面（shadowDynamics）
function renderShadowSection(data, tocItems, sectionId) {
  const s = data.shadowDynamics || {};
  const hasContent = s.opposing || s.criticalParent || s.trickster || s.demon;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: '影の側面' });

  const section = createSection(id, '影の側面として現れるとき', '🌒');
  const grid = createElement('div', 'stages-grid');

  const order = [
    { key: 'opposing', label: '反発として現れるとき' },
    { key: 'criticalParent', label: '厳しい基準として現れるとき' },
    { key: 'trickster', label: '揺さぶりや混乱として現れるとき' },
    { key: 'demon', label: '自己否定や無力感として現れるとき' }
  ];

  order.forEach(item => {
    const text = s[item.key];
    if (!text) return;

    const card = createElement('div', 'stage-card');
    const title = createElement('div', 'stage-card__title', item.label);
    const body = createElement('div', 'stage-card__body');

    formatTextToElements(text).forEach(el => body.appendChild(el));
    card.appendChild(title);
    card.appendChild(body);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return { fragment: section, sectionId };
}

// 7. 認知科学的な補足（cognitiveScience）
function renderCognitiveSection(data, tocItems, sectionId) {
  const c = data.cognitiveScience || {};
  const hasContent = c.notes || c.neural || c.processing;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: '認知科学的な補足' });

  const section = createSection(id, '認知科学的な補足とモデルの限界', '🧠');
  const prose = createElement('div', 'prose');

  if (c.notes) {
    const h3 = createElement('h3', null, 'モデルとしての注意点');
    prose.appendChild(h3);
    formatTextToElements(c.notes).forEach(el => prose.appendChild(el));
  }

  if (c.neural) {
    const h3 = createElement('h3', null, '脳との関係についての仮説');
    prose.appendChild(h3);
    formatTextToElements(c.neural).forEach(el => prose.appendChild(el));
  }

  if (c.processing) {
    const h3 = createElement('h3', null, '情報処理の特徴');
    prose.appendChild(h3);
    formatTextToElements(c.processing).forEach(el => prose.appendChild(el));
  }

  section.appendChild(prose);
  return { fragment: section, sectionId };
}

// 8. 付き合い方のヒント（guidance）
function renderGuidanceSection(data, tocItems, sectionId) {
  const g = data.guidance || {};
  const hasContent = g.resonatesIf || g.notResonateIf;
  if (!hasContent) return { fragment: null, sectionId };

  const id = `section-${sectionId++}`;
  tocItems.push({ id, title: '付き合い方のヒント' });

  const section = createSection(id, 'この機能とうまく付き合うためのヒント', '💡');
  const prose = createElement('div', 'prose');

  if (g.resonatesIf) {
    const h3 = createElement('h3', null, 'しっくりくるとき');
    prose.appendChild(h3);
    formatTextToElements(g.resonatesIf).forEach(el => prose.appendChild(el));
  }

  if (g.notResonateIf) {
    const h3 = createElement('h3', null, '扱いづらく感じるとき');
    prose.appendChild(h3);
    formatTextToElements(g.notResonateIf).forEach(el => prose.appendChild(el));
  }

  section.appendChild(prose);
  return { fragment: section, sectionId };
}

// ==========================================
// 目次・アニメーション
// ==========================================

function buildToc(tocItems) {
  if (!tocItems.length) return null;

  const nav = createElement('nav', 'toc-nav');
  const list = createElement('ul', 'toc-list');

  tocItems.forEach((item, idx) => {
    const li = createElement('li', 'toc-item');
    const a = createElement('a', 'toc-link');
    a.href = `#${item.id}`;

    const number = createElement(
      'span',
      'toc-number',
      (idx + 1).toString().padStart(2, '0')
    );
    const title = createElement('span', 'toc-title', item.title);

    a.appendChild(number);
    a.appendChild(title);
    li.appendChild(a);
    list.appendChild(li);
  });

  nav.appendChild(list);
  return nav;
}

function observeSections(root) {
  if (!('IntersectionObserver' in window)) {
    root.querySelectorAll('.section').forEach(sec =>
      sec.classList.add('section--visible')
    );
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section--visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  root.querySelectorAll('.section').forEach(sec => observer.observe(sec));
}

// ==========================================
// メインロード
// ==========================================

async function loadData() {
  const main = document.getElementById('main-content');
  const container =
    main && main.querySelector('.container') ? main.querySelector('.container') : null;
  const tocRoot = document.getElementById('toc-content');
  const contentRoot = document.getElementById('function-content');

  if (!container || !tocRoot || !contentRoot) {
    console.error('必要なDOM要素が見つかりません');
    return;
  }

  try {
    const res = await fetch(`data/${code}.json`);
    if (!res.ok) throw new Error(`${code}.json が見つかりませんでした`);

    const data = await res.json();

    // タイトル・description
    const titleText =
      data.meta?.seoTitle ||
      `${data.name || ''}（${(data.function || data.code || code).toUpperCase()}）認知機能ガイド — Persona Finder`;
    const descText =
      data.meta?.seoDescription ||
      '認知機能の深層分析';

    const titleEl = document.getElementById('page-title');
    const descEl = document.getElementById('page-description');
    if (titleEl) titleEl.textContent = titleText;
    document.title = titleText;
    if (descEl) descEl.setAttribute('content', descText);

    // ヒーロー更新
    updateHero(data);

    // 中身クリア
    tocRoot.innerHTML = '';
    contentRoot.innerHTML = '';

    const tocItems = [];
    let sectionId = 1;

    const renderers = [
      renderIntroSection,
      renderInnerViewSection,
      renderTheorySection,
      renderStackSection,
      renderDevelopmentSection,
      renderShadowSection,
      renderCognitiveSection,
      renderGuidanceSection
    ];

    const frag = document.createDocumentFragment();

    renderers.forEach(fn => {
      const { fragment, sectionId: nextId } = fn(data, tocItems, sectionId);
      sectionId = nextId;
      if (fragment) frag.appendChild(fragment);
    });

    // 目次（ヒーローの直下に来る）
    const tocNav = buildToc(tocItems);
    if (tocNav) {
      tocRoot.appendChild(tocNav);
    }

    contentRoot.appendChild(frag);

    // アニメーション
    requestAnimationFrame(() => {
      observeSections(contentRoot);
    });
  } catch (err) {
    console.error(err);
    contentRoot.innerHTML = '';
    const box = createInfoBox('エラー', err.message || 'データの読み込みに失敗しました。', true);
    contentRoot.appendChild(box);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadData);
} else {
  loadData();
}
