import katex from "katex";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  FlaskConical,
  GitBranch,
  Menu,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { SimulationLab } from "./components/SimulationLab";
import Orientation from "./content/Orientation.mdx";
import { lessons } from "./data/lessons";
import { parseProgress, PROGRESS_KEY, serializeProgress } from "./progress";

const bareBonesCode = `for (size_t q = 0; q < max_time; ++q) {
    for (size_t m = 0; m < size - 1; ++m) {
        hy[m] += (ez[m + 1] - ez[m]) / eta0;
    }
    for (size_t m = 1; m < size - 1; ++m) {
        ez[m] += eta0 * (hy[m] - hy[m - 1]);
    }
    ez[source] += gaussian(q, delay, width);
}`;

const modularCode = `struct FDTD1DExperimentConfig config =
    fdtd1d_default_experiment_normalized();

config.excitation.type = FDTD1D_EXCITATION_TFSF;
config.right_termination.type =
    FDTD1D_TERMINATION_MATCHED_LAYER;

struct FDTD1D *simulation = fdtd1d_create_experiment(
    &config, error, sizeof(error));

while (fdtd1d_step(simulation) == FDTD1D_OK) {
    observe(fdtd1d_electric(simulation));
}
fdtd1d_destroy(simulation);`;

function Equation({ value }: { value: string }) {
  return <div className="equation" dangerouslySetInnerHTML={{
    __html: katex.renderToString(value, { displayMode: true, throwOnError: false }),
  }} />;
}

function downloadText(filename: string, content: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function App() {
  const [activeId, setActiveId] = useState(() => parseProgress(localStorage.getItem(PROGRESS_KEY))?.lastLessonId || lessons[0].id);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(parseProgress(localStorage.getItem(PROGRESS_KEY))?.completedLessonIds ?? []));
  const [codeMode, setCodeMode] = useState<"bare" | "modular">("bare");
  const [menuOpen, setMenuOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const activeIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === activeId));
  const lesson = lessons[activeIndex];

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, serializeProgress({
      version: 1,
      completedLessonIds: [...completed],
      lastLessonId: activeId,
    }));
    window.location.hash = activeId;
  }, [activeId, completed]);

  const selectLesson = (id: string) => {
    setActiveId(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleComplete = () => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(activeId)) next.delete(activeId);
      else next.add(activeId);
      return next;
    });
  };

  const exportProgress = () => downloadText("ufdtd-progress.json", serializeProgress({
    version: 1,
    completedLessonIds: [...completed],
    lastLessonId: activeId,
  }));

  const importProgress = async (file?: File) => {
    if (!file) return;
    const progress = parseProgress(await file.text());
    if (!progress || !lessons.some((item) => item.id === progress.lastLessonId)) {
      window.alert("進度檔格式不正確。");
      return;
    }
    setCompleted(new Set(progress.completedLessonIds.filter((id) => lessons.some((item) => item.id === id))));
    setActiveId(progress.lastLessonId);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open course navigation"><Menu /></button>
        <a className="brand" href="#numeric-evidence" onClick={() => selectLesson(lessons[0].id)}>
          <span className="brand-mark">uF</span>
          <span><strong>FDTD Lab</strong><small>從方程到可驗證程式</small></span>
        </a>
        <div className="topbar-meta"><span>C17</span><span>WASM</span><a href="https://github.com/tintinjian12999/FDTD_Practice" target="_blank" rel="noreferrer"><GitBranch size={17} /> GitHub</a></div>
      </header>

      <aside className={`course-nav ${menuOpen ? "course-nav--open" : ""}`}>
        <div className="nav-mobile-heading"><strong>課程路徑</strong><button onClick={() => setMenuOpen(false)} aria-label="Close course navigation"><X /></button></div>
        <div className="progress-summary">
          <div><span>LEARNING PATH</span><strong>{completed.size}<small> / {lessons.length}</small></strong></div>
          <div className="progress-track"><span style={{ width: `${(completed.size / lessons.length) * 100}%` }} /></div>
        </div>
        <nav aria-label="Lesson navigation">
          {lessons.map((item) => <button key={item.id} className={item.id === activeId ? "active" : ""} onClick={() => selectLesson(item.id)}>
            <span className="lesson-number">{String(item.number).padStart(2, "0")}</span>
            <span><strong>{item.title}</strong><small>{item.eyebrow}</small></span>
            <span className={`lesson-check ${completed.has(item.id) ? "done" : ""}`}>{completed.has(item.id) && <Check size={12} />}</span>
          </button>)}
        </nav>
        <div className="progress-tools">
          <button onClick={exportProgress}><Download size={14} />匯出進度</button>
          <button onClick={() => importRef.current?.click()}><Upload size={14} />匯入</button>
          <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => void importProgress(event.target.files?.[0])} />
        </div>
      </aside>

      <main>
        <article className="lesson-article">
          <div className="lesson-hero">
            <div className="lesson-label"><span>LESSON {String(lesson.number).padStart(2, "0")}</span><span>{lesson.reference}</span></div>
            <h1>{lesson.title}</h1>
            <p className="lesson-lead">{lesson.summary}</p>
            <div className="hero-actions">
              <button className={`complete-button ${completed.has(activeId) ? "complete" : ""}`} onClick={toggleComplete}><Check size={16} />{completed.has(activeId) ? "已完成" : "標記完成"}</button>
              <span>原創 companion · 非教科書全文重製</span>
            </div>
          </div>

          <div className="lesson-columns">
            <section>
              <span className="section-kicker">CONCEPT</span>
              <h2>這一步在算什麼</h2>
              <p>{lesson.detail}</p>
              {lesson.equation && <Equation value={lesson.equation} />}
              {lesson.number === 1 && <div className="mdx-note"><Orientation /></div>}
            </section>
            <aside className="outcome-card">
              <BookOpen size={20} />
              <span className="section-kicker">AFTER THIS LESSON</span>
              <ul>{lesson.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
            </aside>
          </div>

          <div className="experiment-brief">
            <FlaskConical />
            <div><span className="section-kicker">MEASURE, DON'T GUESS</span><h3>本節實驗</h3><p>{lesson.experiment}</p></div>
            <p className="caution"><strong>判讀界線</strong>{lesson.caution}</p>
          </div>
        </article>

        <SimulationLab />

        <section className="code-workbench">
          <div className="code-heading">
            <div><span className="section-kicker">READ THE IMPLEMENTATION</span><h2>C 程式碼：公式版與工程版</h2></div>
            <button className="icon-button" onClick={() => downloadText(codeMode === "bare" ? "fdtd_bare_bones.c" : "fdtd_modular.c", codeMode === "bare" ? bareBonesCode : modularCode)}><Download size={16} />下載 .c</button>
          </div>
          <div className="code-tabs">
            <button className={codeMode === "bare" ? "active" : ""} onClick={() => setCodeMode("bare")}><Code2 size={15} />Bare-bones</button>
            <button className={codeMode === "modular" ? "active" : ""} onClick={() => setCodeMode("modular")}><Code2 size={15} />Modular core</button>
          </div>
          <pre><code>{codeMode === "bare" ? bareBonesCode : modularCode}</code></pre>
          <p>{codeMode === "bare" ? "教學版直接對應更新方程，適合逐行理解。" : "工程版把驗證、材料係數、TFSF 與終端封裝在核心內，呼叫端只描述實驗。"}</p>
        </section>

        <nav className="lesson-pager" aria-label="Previous and next lesson">
          <button disabled={activeIndex === 0} onClick={() => selectLesson(lessons[activeIndex - 1].id)}><ChevronLeft />上一節</button>
          <span>{activeIndex + 1} / {lessons.length}</span>
          <button disabled={activeIndex === lessons.length - 1} onClick={() => selectLesson(lessons[activeIndex + 1].id)}>下一節<ChevronRight /></button>
        </nav>

        <footer>
          <span>Numerical code: MIT · Original learning content: CC BY-SA 4.0</span>
          <span>Validated 1D scope · TFSF · nondispersive materials · matched absorbing layer</span>
        </footer>
      </main>
    </div>
  );
}
