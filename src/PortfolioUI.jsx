import { assetPath } from "./lib/assetPath.js";
import { Component, useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { projects } from './data/portfolio';
function useReducedMotion() {
  const [value, setValue] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setValue(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  return value;
}

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? <div className="scene-fallback"><img src={assetPath("/assets/town-poster.svg")} alt="创作小镇平面导览"/><p>当前设备使用平面导览，作品索引仍可完整浏览。</p></div> : this.props.children; }
}

function ProjectArt({ project, large = false }) {
  if (project.media) { const clip=project.media[0]; return <img className="project-art project-cover motion-cover" src={clip.thumbnail||clip.poster} srcSet={clip.thumbnail?`${clip.thumbnail} 480w, ${clip.poster} ${Math.min(1280,clip.width)}w`:undefined} sizes="(min-width:760px) 33vw, 100vw" width={clip.width} height={clip.height} loading="lazy" decoding="async" alt={`${project.title}${project.district==='other'?'项目':'动效'}封面`}/>; }
  if (project.caseStudy) return <img className="project-art project-cover" src={project.caseStudy.cover} width={project.caseStudy.coverWidth} height={project.caseStudy.coverHeight} loading="lazy" decoding="async" alt={`${project.title}项目封面`}/>;
  const i = projects.findIndex(p => p.id === project.id), id = `art-${project.id}-${large ? 'lg' : 'sm'}`;
  const pink = project.district === 'projects', motion = project.district === 'motion';
  const background = pink ? '#e8c6d6' : motion ? '#d9d7a0' : '#b5d9df';
  return <svg className={`project-art ${large ? 'large' : ''}`} viewBox="0 0 600 400" role="img" aria-label={`${project.title}的示意封面`}>
    <defs><pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".8" fill="#4b438a" opacity=".2"/></pattern></defs>
    <rect width="600" height="400" fill={background}/><rect width="600" height="400" fill={`url(#${id})`}/>
    <circle cx={430 - i * 3} cy="104" r="53" fill="#f8e89e"/>
    {motion ? <g transform="translate(280 210)">
      <ellipse cy="100" rx="134" ry="19" fill="#777094" opacity=".16"/>
      <g className={`art-motion ${project.number === 'B' ? 'is-sculpture' : ''}`}>
        <path d="M-90 35 -30-95 85-25 30 95Z" fill="#4b438a"/><path d="M-30-95 130-65 85-25Z" fill="#fff0ec"/><path d="M85-25 130-65 112 49 30 95Z" fill="#e792ba"/>
        <circle cx="-40" cy="35" r="40" fill="#b9e5e7"/>
      </g><path d="M-160 100 160 100M0-145V135" stroke="#fff3ed" strokeWidth="1" strokeDasharray="3 6"/>
    </g> : <g transform={`translate(${80 + i % 3 * 12} 140) skewY(-12)`}>
      <path d="M0 130 250 190 420 100 170 40Z" fill="#958bb4" opacity=".2"/>
      <path d="M35 100V0L95-57 155 0V100Z" fill="#fff0ed"/><path d="M95-57 200-35 260 22 155 0Z" fill="#4b438a"/><path d="M155 0 260 22V122L155 100Z" fill="#a69dc0"/>
      <path d="M210 160V55L260 9 310 55V160Z" fill="#f4d5df"/><path d="M260 9 355 30 405 76 310 55Z" fill="#635597"/><path d="M310 55 405 76V179L310 160Z" fill="#c4b8d3"/>
      <path d="M65 18h35v40H65Zm170 58h27v35h-27Z" fill="#acdce1"/><path d="M108 65h22v35h-22Zm162 56h22v39h-22Z" fill="#c3a2be"/>
      <path d="M20 170 420 250M-10 190 395 270" stroke="#fff0ed" strokeWidth="2"/>
    </g>}
    {large && <><text x="32" y="43" fill="#4b438a" fontSize="13" letterSpacing="3">{project.type}</text><text x="32" y="365" fill="#4b438a" fontSize="22">{project.title}</text><text x="563" y="365" textAnchor="end" fill="#4b438a" fontSize="13">{project.number}</text></>}
  </svg>;
}

function Blueprint() {
  return <svg className="blueprint" viewBox="0 0 1200 520" aria-hidden="true">
    <g transform="translate(55 55) rotate(-13 500 200)" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M0 160H1110M0 190H1110M0 0H1110V380H0Z" opacity=".45"/>
      {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`translate(${i * 138 + 12} 12)`}><path d="M0 0H118V125H0Z M10 10H52V55H10Z M63 10H108V82H63Z M10 68H52V115H10Z M63 95H108V115"/><path d="M52 68A15 15 0 0 1 67 83M52 68V83H67"/><circle cx="84" cy="46" r="11"/><path d="M12 220H118V350H12Z M25 235H60V285H25Z M72 235H106V270H72Z M25 302H106V336H25Z"/></g>)}
      <path d="M-20 410H1140M-20 400V420M1140 400V420M560 380V435"/><path d="M-35-10V390M-45-10H-25M-45 390H-25"/>
      <circle cx="1070" cy="295" r="22"/><path d="M1070 265V325M1040 295H1100"/>
    </g>
  </svg>;
}

function Dialog({ label, onClose, children, kind = '', showClose = true }) {
  const panel = useRef(), previousFocus = useRef(document.activeElement);
  useGSAP(() => { gsap.from(panel.current, { y: 32, opacity: 0, duration: .45, ease: 'power3.out' }); }, { scope: panel });
  useEffect(() => {
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    panel.current?.querySelector('button')?.focus();
    function key(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const targets = [...panel.current.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,video[controls]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
      if (!targets.length) return;
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', key); previousFocus.current?.focus?.({preventScroll:true}); };
  }, [onClose]);
  return <div className={`dialog-backdrop ${kind}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={panel} className="dialog-panel" role="dialog" aria-modal="true" aria-label={label} data-lenis-prevent>
      {showClose && <button className="icon-button dialog-close" aria-label="关闭" onClick={onClose}><X size={21}/></button>}
      {children}
    </section>
  </div>;
}

export { ProjectArt, Blueprint, Dialog, SceneBoundary, useReducedMotion };

