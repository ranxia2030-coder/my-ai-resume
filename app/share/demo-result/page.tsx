import { Download, FileText, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const sharedResume = `张明
联系方式已隐藏 | 上海

求职方向：AI 产品经理

个人简介
3 年产品经理经验，重点参与企业后台、内部效率工具、智能客服知识库和用户增长相关项目。熟悉需求调研、产品规划、原型设计、跨部门项目推进与上线迭代。

核心技能
- 产品能力：需求分析、用户调研、PRD 撰写、原型设计、版本规划、跨部门协作。
- B 端产品：参与企业客户管理后台、内部效率工具或运营配置平台建设。
- ATS 关键词：AI 产品、智能客服、知识库、自动化工具、企业后台、工作流、数据反馈。

工作经历
星河科技 | 产品经理 | 2022.03 - 至今
- 负责企业客户管理后台和内部效率工具的需求梳理与功能设计。
- 参与用户增长活动配置工具建设，推动配置链路标准化。
- 基于用户反馈、客服问题和使用数据整理迭代需求。`;

export default function ShareDemoResultPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Share2 size={20} />
          </div>
          <div>
            <h1 className="brand-title">分享结果页</h1>
            <p className="brand-subtitle">联系方式已默认隐藏，适合发给朋友查看效果。</p>
          </div>
        </div>
        <div className="top-actions">
          <Link className="button secondary" href="/">
            返回工作台
          </Link>
        </div>
      </header>

      <section className="workspace" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px" }}>
        <section className="column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <FileText size={17} color="#1d4ed8" />
                  <h2 className="panel-title">优化版简历预览</h2>
                </div>
                <p className="panel-kicker">这是分享状态下的演示结果，手机号和邮箱已隐藏。</p>
              </div>
            </div>
            <div className="panel-body">
              <article className="resume-doc">{sharedResume}</article>
            </div>
          </section>
        </section>

        <aside className="column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <ShieldCheck size={17} color="#059669" />
                  <h2 className="panel-title">匹配摘要</h2>
                </div>
                <p className="panel-kicker">分享页只展示必要结果，不公开原始上传文件。</p>
              </div>
            </div>
            <div className="panel-body stack">
              <div className="score-comparison">
                <div className="mini-score">
                  <div className="mini-score-label">当前匹配度</div>
                  <div className="mini-score-value">76</div>
                </div>
                <div className="mini-score">
                  <div className="mini-score-label">优化后预计</div>
                  <div className="mini-score-value">88</div>
                </div>
              </div>
              <div className="callout success">建议：可以使用优化版简历投递，并继续补充真实量化结果。</div>
              <div className="privacy-note">
                <LockKeyhole size={15} />
                <span>分享页默认隐藏手机号和邮箱。真实版本会提供隐私开关。</span>
              </div>
              <button className="button secondary full" type="button">
                <Download size={16} />
                下载功能在工作台生成
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
