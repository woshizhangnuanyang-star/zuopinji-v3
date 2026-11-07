
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, MagnifyingGlassPlus, MagnifyingGlassMinus, X } from '@phosphor-icons/react';
import { Dialog } from '../PortfolioUI';
import './motion-project.css';

function durationText(seconds) {
  const total = Math.round(seconds);
  return seconds >= 60
    ? Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0')
    : Math.round(seconds * 10) / 10 + ' 秒';
}

function defaultQuality() {
  const connection = navigator.connection;
  return matchMedia('(max-width:760px)').matches || connection?.saveData ||
    ['slow-2g', '2g', '3g'].includes(connection?.effectiveType) ? 'stream' : 'hd';
}

export default function MotionProject({ project, onClose, onPlay }) {
  const [selected, setSelected] = useState(0);
  const [quality, setQuality] = useState(defaultQuality);
  const [view, setView] = useState('video');
  const [posterIndex, setPosterIndex] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  const video = useRef(null);
  const pendingTime = useRef(0);
  const stageId = useId();
  const showingPoster = view === 'posters';
  const clip = project.media[selected];
  const source = quality === 'stream' && clip.small ? clip.small : clip;
  const poster = project.posters?.[posterIndex];
  const choices = showingPoster ? project.posters : project.media;
  const choiceIndex = showingPoster ? posterIndex : selected;
  const hasChoices = choices.length > 1;
  const hasControls = !!project.posters || (!showingPoster && !!clip.small);
  const currentLabel = showingPoster ? poster.label : clip.label;

  useEffect(() => {
    const node = video.current;
    return () => {
      if (!node) return;
      node.pause();
      node.removeAttribute('src');
      node.load();
    };
  }, [source.src, view]);

  function savePlaybackPosition() {
    pendingTime.current = video.current?.ended ? 0 : (video.current?.currentTime || 0);
  }

  function selectChoice(index) {
    if (index === choiceIndex) return;
    setFailed(false);
    if (showingPoster) {
      setPosterIndex(index);
      setEnlarged(false);
    } else {
      pendingTime.current = 0;
      setSelected(index);
    }
  }

  function changeQuality(value) {
    savePlaybackPosition();
    setFailed(false);
    setQuality(value);
  }

  function changeView(next) {
    if (next === view) return;
    if (view === 'video') savePlaybackPosition();
    setFailed(false);
    setEnlarged(false);
    setView(next);
  }

  function moveChoiceFocus(event) {
    const { key } = event;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    let next;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = choices.length - 1;
    else {
      const direction = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
      next = (choiceIndex + direction + choices.length) % choices.length;
    }
    selectChoice(next);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  function retryMedia() {
    setFailed(false);
    if (showingPoster) setRetry(value => value + 1);
    else video.current?.load();
  }

  return (
    <Dialog label={project.title + '视频作品'} onClose={onClose} kind="motion-viewer" showClose={false}>
      <header className="motion-toolbar">
        <div className="motion-heading">
          <h2>{project.title}</h2>
          <p>{project.district === 'other' ? '其他设计' : '动效设计'} / {project.type}</p>
        </div>
        <button className="motion-close" aria-label="关闭" onClick={onClose}><X size={20} /></button>
      </header>

      <div className="motion-body">
        {hasControls && (
          <div className="motion-controls">
            {project.posters && (
              <div className="motion-modes" role="group" aria-label="作品展示方式">
                <button aria-pressed={!showingPoster} aria-controls={stageId} onClick={() => changeView('video')}>
                  动态影像 <small>{project.media.length}</small>
                </button>
                <button aria-pressed={showingPoster} aria-controls={stageId} onClick={() => changeView('posters')}>
                  系列海报 <small>{project.posters.length}</small>
                </button>
              </div>
            )}
            {!showingPoster && clip.small && (
              <label className="motion-quality">
                <span>画质</span>
                <select aria-label="视频画质" value={quality} onChange={event => changeQuality(event.target.value)}>
                  <option value="stream">流畅 · {clip.small.height}p</option>
                  <option value="hd">清晰 · {clip.height}p</option>
                </select>
              </label>
            )}
            {showingPoster && (
              <button className="motion-zoom" aria-pressed={enlarged} onClick={() => setEnlarged(value => !value)}>
                {enlarged ? <MagnifyingGlassMinus size={17} /> : <MagnifyingGlassPlus size={17} />}
                {enlarged ? '完整显示' : '查看细节'}
              </button>
            )}
          </div>
        )}

        <div className={'motion-workspace' + (hasChoices ? ' has-choices' : '')}>
          <section
            className="motion-media"
            id={stageId}
            role={hasChoices ? 'tabpanel' : undefined}
            aria-labelledby={hasChoices ? stageId + '-choice-' + choiceIndex : undefined}
            aria-label={hasChoices ? undefined : currentLabel}
          >
            {showingPoster ? (
              <figure className={'motion-poster-stage' + (enlarged ? ' is-enlarged' : '')} tabIndex={enlarged ? 0 : undefined}>
                <img
                  key={poster.id + '-' + retry}
                  src={poster.src}
                  srcSet={poster.thumbnail + ' 480w, ' + poster.src + ' 1600w'}
                  sizes={enlarged ? '1080px' : '(min-width: 761px) 540px, 92vw'}
                  width={poster.width}
                  height={poster.height}
                  alt={poster.label + '，TD 动态海报平面设计'}
                  decoding="async"
                  onError={() => setFailed(true)}
                  onLoad={() => setFailed(false)}
                />
              </figure>
            ) : (
              <div className="motion-video-stage">
                <video
                  key={source.src}
                  ref={video}
                  src={source.src}
                  poster={clip.poster}
                  width={source.width}
                  height={source.height}
                  controls
                  playsInline
                  preload="none"
                  aria-label={project.title + '：' + clip.label}
                  onLoadedMetadata={() => {
                    if (!pendingTime.current) return;
                    const node = video.current;
                    node.currentTime = Math.min(pendingTime.current, node.duration || pendingTime.current);
                    pendingTime.current = 0;
                  }}
                  onError={() => setFailed(true)}
                  onPlay={() => {
                    onPlay?.();
                    document.querySelectorAll('video').forEach(node => {
                      if (node !== video.current) node.pause();
                    });
                  }}
                />
              </div>
            )}
            <div className="motion-caption">
              <span>{currentLabel}</span>
              <span>{showingPoster ? (posterIndex + 1) + ' / ' + choices.length : durationText(clip.duration)}</span>
            </div>
            {failed && (
              <div className="motion-error" role="alert">
                <p>{showingPoster ? '这张海报' : '这段视频'}暂时未能加载。</p>
                <button onClick={retryMedia}>重新加载</button>
              </div>
            )}
          </section>

          {hasChoices && (
            <aside className={'motion-picker' + (showingPoster ? ' is-poster-picker' : '')}>
              <p>{showingPoster ? '海报系列' : '视频版本'}</p>
              <div role="tablist" aria-label={showingPoster ? '选择海报' : '选择视频版本'} onKeyDown={moveChoiceFocus}>
                {choices.map((item, index) => (
                  <button
                    key={item.id}
                    id={stageId + '-choice-' + index}
                    role="tab"
                    aria-selected={choiceIndex === index}
                    aria-controls={stageId}
                    tabIndex={choiceIndex === index ? 0 : -1}
                    onClick={() => selectChoice(index)}
                  >
                    <img src={item.thumbnail || item.poster} alt="" width="48" height="48" loading="lazy" decoding="async" />
                    <span>{item.label}{!showingPoster && <small>{durationText(item.duration)}</small>}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>

        <footer className="motion-bottom">
          <p>{project.description}</p>
          <button className="text-link" onClick={onClose}><ArrowLeft size={17} />返回作品</button>
        </footer>
      </div>
    </Dialog>
  );
}
