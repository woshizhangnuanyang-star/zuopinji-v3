import { assetPath } from "../lib/assetPath.js";

import { useEffect } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { about } from '../data/about';
import './about-profile.css';

function SectionHeading({ id, number, children }) {
  return (
    <h2 id={id} className="profile-section-title">
      {number && <span aria-hidden="true">{number}</span>}
      {children}
    </h2>
  );
}

export default function AboutProfile({ headingRef }) {
  const { education, contact } = about;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [headingRef]);

  return (
    <div className="about-profile">
      <header className="profile-masthead">
        <div>
          <p className="profile-folio">01 / 创作者档案</p>
          <h1 ref={headingRef} tabIndex={-1}>个人介绍</h1>
        </div>
        <p className="profile-specialties">设计 · 动效 · 数字体验</p>
      </header>

      <div className="profile-spread">
        <aside className="profile-identity" aria-labelledby="profile-name">
          <div className="profile-person">
            <div className="profile-portrait-wrap">
              <img
                className="about-portrait"
                src={assetPath("/assets/about/zhang-nuanyang.webp")}
                width="451"
                height="575"
                alt={about.name + '的个人照片'}
                decoding="async"
              />
            </div>
            <div className="profile-name">
              <span className="profile-alias">{about.englishName}</span>
              <h2 id="profile-name">{about.name}</h2>
              <p>产品设计 · 信息交互</p>
            </div>
          </div>

          <section aria-labelledby="about-basic">
            <SectionHeading id="about-basic">基本信息</SectionHeading>
            <dl className="profile-basic">
              <div><dt>出生年月</dt><dd>{about.birth}</dd></div>
              <div><dt>政治面貌</dt><dd>{about.affiliation}</dd></div>
              <div><dt>在读院校</dt><dd>{education.school}</dd></div>
              <div><dt>专业</dt><dd>{education.major}</dd></div>
              <div><dt>学历</dt><dd>{education.degree}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="about-introduction">
            <SectionHeading id="about-introduction">自我评价</SectionHeading>
            <div className="profile-introduction">
              {about.selfEvaluation.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>

          <section aria-labelledby="about-contact">
            <SectionHeading id="about-contact">作品集与联系方式</SectionHeading>
            <dl className="profile-contact">
              <div>
                <dt>作品集</dt>
                <dd><a href={contact.portfolio} target="_blank" rel="noreferrer">{new URL(contact.portfolio).host}<ArrowUpRight size={14} aria-hidden="true" /></a></dd>
              </div>
              <div><dt>电话</dt><dd><a href={'tel:' + contact.phone}>{contact.phone}</a></dd></div>
              <div><dt>邮箱</dt><dd><a href={'mailto:' + contact.email}>{contact.email}</a></dd></div>
            </dl>
          </section>
        </aside>

        <div className="profile-main">
          <section className="profile-education" aria-labelledby="about-education">
            <SectionHeading id="about-education" number="01">教育背景</SectionHeading>
            <div className="profile-school">
              <div><h3>{education.school}</h3><p>{education.degree} · {education.major}</p></div>
              <p className="profile-date">{education.date}</p>
            </div>
            <p className="profile-campus-role">{education.campusRole}</p>

            <dl className="profile-grades">
              {education.grades.map(({ label, score, scale, rank }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd><strong>{score}</strong>{scale && <span>{scale}</span>}<small>排名 {rank}</small></dd>
                </div>
              ))}
            </dl>

            <h3 className="profile-subheading">项目经历</h3>
            <ul className="profile-study-projects">
              {education.projects.map(({ name, role }) => (
                <li key={name}><span>{name}</span><small>{role}</small></li>
              ))}
            </ul>
          </section>

          <section className="profile-internships" aria-labelledby="about-experience">
            <SectionHeading id="about-experience" number="02">实习经历</SectionHeading>
            <ol className="profile-timeline">
              {about.experience.map(({ date, company, role, responsibilities }) => (
                <li key={company}>
                  <p className="profile-date">{date}</p>
                  <div className="profile-job"><h3>{company}</h3><p>{role}</p></div>
                  <ul className="profile-responsibilities">
                    {responsibilities.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          <section className="profile-honors" aria-labelledby="about-awards">
            <SectionHeading id="about-awards" number="03">获得荣誉</SectionHeading>
            {about.honors.map(({ year, entries }) => (
              <div className="profile-award-year" key={year}>
                <h3>{year} 年</h3>
                <ul>
                  {entries.map(([title, result, kind]) => (
                    <li key={title}>
                      <h4>{title}</h4>
                      <p className={kind === 'progress' ? 'profile-award-progress' : undefined}>{result}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="profile-toolbox" aria-labelledby="about-skills">
            <SectionHeading id="about-skills" number="04">技能与证书</SectionHeading>
            <dl className="profile-skill-groups">
              {about.skills.map(({ label, tools }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{tools.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
