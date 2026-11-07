
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ListBullets, MagnifyingGlassPlus, MagnifyingGlassMinus, X } from '@phosphor-icons/react';
import { Dialog, useReducedMotion } from '../PortfolioUI';
import './project-case-study.css';

// Read just below the toolbar so fractional scroll positions do not switch chapters at a seam.
const READING_INSET = 4;

function CaseSlice({ page, index, title, zoomed }) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const sizes = zoomed
    ? '(max-width: 820px) 960px, 1920px'
    : '(min-width: 1320px) 1120px, (min-width: 821px) calc(100vw - 210px), 100vw';

  return (
    <figure className="case-slice" style={{ aspectRatio: page.width + '/' + page.height }} data-source-page={page.sourcePage} data-part={page.part}>
      <img
        key={retry}
        src={page.src}
        srcSet={page.small + ' 960w, ' + page.src + ' 1920w'}
        sizes={sizes}
        width={page.width}
        height={page.height}
        loading={index < 2 ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={index === 0 ? 'high' : 'auto'}
        alt={title + '：' + page.label + '，第 ' + page.sourcePage + ' 页' + (page.part > 1 ? '（续）' : '')}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {failed && (
        <div className="case-image-error">
          <p>这部分图片暂时未能加载。</p>
          <button onClick={() => { setFailed(false); setRetry(n => n + 1); }}>重新加载</button>
        </div>
      )}
    </figure>
  );
}

export default function ProjectCaseStudy({ project, onClose }) {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const viewport = useRef(null);
  const menuToggle = useRef(null);
  const anchors = useRef(new Map());
  const zoomAnchor = useRef(null);
  const chaptersId = useId();
  const [zoomed, setZoomed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const groups = useMemo(() => {
    const result = [];
    project.caseStudy.pages.forEach((page, index) => {
      if (page.chapter || !result.length) {
        result.push({ label: page.chapter || '项目概览', pages: [] });
      }
      result[result.length - 1].pages.push({ page, index });
    });
    return result;
  }, [project]);

  const [activeChapter, setActiveChapter] = useState(groups[0]?.label);
  const hasChapters = groups.length > 1;

  useEffect(() => {
    viewport.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [project.id]);

  useEffect(() => {
    if (!hasChapters) return;
    const panel = viewport.current;
    let frame = 0;

    function updateChapter() {
      frame = 0;
      const edge = panel.getBoundingClientRect().top + READING_INSET;
      let label = groups[0].label;
      for (const group of groups) {
        const section = anchors.current.get(group.label);
        if (!section || section.getBoundingClientRect().top > edge) break;
        label = group.label;
      }
      if (panel.scrollTop > 0 && panel.scrollHeight - panel.scrollTop - panel.clientHeight < 2) {
        label = groups[groups.length - 1].label;
      }
      setActiveChapter(label);
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(updateChapter);
    }

    scheduleUpdate();
    panel.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [groups, hasChapters, zoomed]);

  function toggleZoom() {
    const edge = viewport.current.getBoundingClientRect().top + READING_INSET;
    const node = [...root.current.querySelectorAll('.case-slice')].find(
      slice => slice.getBoundingClientRect().bottom > edge,
    );
    if (node) {
      const rect = node.getBoundingClientRect();
      zoomAnchor.current = { node, fraction: Math.max(0, Math.min(1, (edge - rect.top) / rect.height)) };
    }
    setZoomed(value => !value);
  }

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (!anchor) return;
    const panel = viewport.current;
    const rect = anchor.node.getBoundingClientRect();
    const edge = panel.getBoundingClientRect().top + READING_INSET;
    panel.scrollTo({
      top: panel.scrollTop + rect.top + rect.height * anchor.fraction - edge,
      behavior: 'instant',
    });
    if (!zoomed) root.current.querySelector('.case-artboard').scrollLeft = 0;
    zoomAnchor.current = null;
  }, [zoomed]);

  function goChapter(label) {
    const section = anchors.current.get(label);
    if (!section) return;
    const panel = viewport.current;
    const edge = panel.getBoundingClientRect().top;
    setMenuOpen(false);
    section.focus({ preventScroll: true });
    panel.scrollTo({
      top: panel.scrollTop + section.getBoundingClientRect().top - edge,
      behavior: reduced ? 'instant' : 'smooth',
    });
  }

  function goTop() {
    viewport.current.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  }

  function dismissMenu(event) {
    if (event.key !== 'Escape' || !menuOpen) return;
    event.stopPropagation();
    setMenuOpen(false);
    menuToggle.current?.focus();
  }

  const readerClass = 'case-reader' + (hasChapters ? ' has-chapters' : '');

  return (
    <Dialog label={project.title + '完整项目'} onClose={onClose} kind="case-study-dialog" showClose={false}>
      <div
        className={'case-study' + (zoomed ? ' is-zoomed' : '') + (menuOpen ? ' is-menu-open' : '')}
        ref={root}
        onKeyDown={dismissMenu}
        onPointerDown={event => {
          if (menuOpen && !event.target.closest('.case-chapters, .case-menu-toggle')) setMenuOpen(false);
        }}
      >
        <header className="case-toolbar">
          <div className="case-toolbar-inner">
            <button className="case-back" aria-label="返回作品" onClick={onClose}><ArrowLeft size={18} /><span>返回作品</span></button>
            <div className="case-identity">
              <h2>{project.title}</h2>
              <p>{zoomed ? '横向滑动查看细节' : project.tag}</p>
            </div>
            {hasChapters && (
              <button
                className="case-menu-toggle"
                ref={menuToggle}
                aria-label="章节目录"
                aria-expanded={menuOpen}
                aria-controls={chaptersId}
                onClick={() => setMenuOpen(value => !value)}
              ><ListBullets size={19} /></button>
            )}
            <button
              className="case-zoom"
              aria-label={zoomed ? '适合屏幕' : '放大阅读'}
              aria-pressed={zoomed}
              onClick={toggleZoom}
            >{zoomed ? <MagnifyingGlassMinus size={19} /> : <MagnifyingGlassPlus size={19} />}<span>{zoomed ? '适合屏幕' : '放大阅读'}</span></button>
            <button className="case-close" aria-label="关闭" onClick={onClose}><X size={20} /></button>
          </div>
        </header>

        <div className="case-viewport" ref={viewport}>
          <div className={readerClass}>
            {hasChapters && (
              <nav className="case-chapters" id={chaptersId} aria-label={project.title + '项目章节'}>
                <div className="case-chapter-list">
                  <p>章节目录</p>
                  {groups.map(({ label }, index) => (
                    <button key={label} aria-current={activeChapter === label ? 'location' : undefined} onClick={() => goChapter(label)}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </nav>
            )}
            <div className="case-content">
              <div className="case-artboard" tabIndex={zoomed ? 0 : undefined}>
                <article className="case-pages" aria-label={project.title + '连续项目展板'}>
                  {groups.map(group => (
                    <section
                      key={group.label}
                      className="case-section"
                      aria-label={group.label}
                      tabIndex={-1}
                      ref={node => {
                        if (node) anchors.current.set(group.label, node);
                        else anchors.current.delete(group.label);
                      }}
                    >
                      {group.pages.map(({ page, index }) => (
                        <CaseSlice key={page.src} page={page} index={index} title={project.title} zoomed={zoomed} />
                      ))}
                    </section>
                  ))}
                </article>
              </div>
              <footer className="case-footer">
                <div><strong>{project.title}</strong><p>感谢浏览这个项目。</p></div>
                <button onClick={goTop}>回到顶部<ArrowUp size={17} /></button>
                <button onClick={onClose}>返回作品列表<ArrowLeft size={17} /></button>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
