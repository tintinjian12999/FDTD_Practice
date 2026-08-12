import katex from "katex";
import { BookOpen, CheckCircle2, Code2, FlaskConical, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { LessonDetail } from "../data/lessonDetails";

function Equation({ value }: { value: string }) {
  return <div className="equation" dangerouslySetInnerHTML={{
    __html: katex.renderToString(value, { displayMode: true, throwOnError: false }),
  }} />;
}

interface LessonContentProps {
  detail: LessonDetail;
  outcomes: string[];
  orientation?: ReactNode;
}

export function LessonContent({ detail, outcomes, orientation }: LessonContentProps) {
  return (
    <div className="lesson-content">
      <section className="learning-map" aria-labelledby="learning-map-title">
        <div>
          <span className="section-kicker">BEFORE YOU START</span>
          <h2 id="learning-map-title">先備知識</h2>
          <ul>{detail.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <BookOpen size={20} />
          <span className="section-kicker">AFTER THIS LESSON</span>
          <ul>{outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
        </div>
      </section>

      {orientation && <div className="mdx-note">{orientation}</div>}

      <div className="concept-sequence">
        {detail.concepts.map((concept, index) => (
          <section className="concept-block" key={concept.title}>
            <span className="concept-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <span className="section-kicker">CONCEPT</span>
              <h2>{concept.title}</h2>
              {concept.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {concept.equation && <Equation value={concept.equation} />}
              {concept.bullets && <ul className="concept-bullets">
                {concept.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>}
            </div>
          </section>
        ))}
      </div>

      <section className="worked-example">
        <div className="worked-example-heading">
          <span className="section-kicker">WORKED EXAMPLE</span>
          <h2>{detail.workedExample.title}</h2>
        </div>
        <div className="worked-example-grid">
          <div><strong>已知</strong><ul>{detail.workedExample.given.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><strong>推導</strong><ol>{detail.workedExample.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
        </div>
        <p className="worked-result"><CheckCircle2 size={17} /><span><strong>結論</strong>{detail.workedExample.result}</span></p>
      </section>

      <section className="code-bridge">
        <div>
          <Code2 size={20} />
          <span className="section-kicker">FROM EQUATION TO C</span>
          <h2>{detail.codeBridge.title}</h2>
          <p>{detail.codeBridge.explanation}</p>
        </div>
        <pre><code>{detail.codeBridge.snippet}</code></pre>
      </section>

      <section className="guided-experiment">
        <div className="guided-experiment-heading">
          <FlaskConical size={21} />
          <div><span className="section-kicker">GUIDED EXPERIMENT</span><h2>本節實驗</h2></div>
        </div>
        <p className="experiment-goal"><strong>目標</strong>{detail.experiment.goal}</p>
        <div className="experiment-grid">
          <div><strong>設定</strong><ul>{detail.experiment.setup.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><strong>步驟</strong><ol>{detail.experiment.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
          <div><strong>預期觀察</strong><ul>{detail.experiment.expected.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><strong>完成標準</strong><ul>{detail.experiment.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section className="misconceptions">
        <span className="section-kicker">COMMON MISCONCEPTIONS</span>
        <h2>常見誤解</h2>
        <div className="misconception-grid">
          {detail.misconceptions.map((item) => (
            <div key={item.claim}><strong>{item.claim}</strong><p>{item.correction}</p></div>
          ))}
        </div>
      </section>

      <section className="self-checks">
        <div><HelpCircle size={20} /><span className="section-kicker">SELF CHECK</span><h2>先回答，再展開答案</h2></div>
        {detail.selfChecks.map((item, index) => (
          <details key={item.question}>
            <summary><span>{index + 1}</span>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
