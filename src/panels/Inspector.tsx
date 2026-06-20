import { useStore } from '../state/store'
import { ConsentBadge, Dir } from '../components/ui'
import { statementSnippet } from '../lib/derive'
import { StatementEditor } from './StatementEditor'
import { NarratorEditor } from './NarratorEditor'
import { TestimonyEditor } from './TestimonyEditor'

/**
 * The inspector shows one of three things, in priority order: the selected
 * statement, the selected narrator, or (the home state) the testimony identity.
 */
export function Inspector() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const selectedNarratorId = useStore((s) => s.selectedNarratorId)

  const statement = selectedStatementId
    ? project.statements.find((s) => s.id === selectedStatementId)
    : undefined
  const narrator = selectedNarratorId
    ? project.testimony.narrators.find((n) => n.id === selectedNarratorId)
    : undefined

  if (statement) {
    return (
      <>
        <div className="panel-head">
          <span className="label"><span className="label-num">ST</span>Statement</span>
          <ConsentBadge consent={statement.consent} />
        </div>
        <div className="inspector-title">
          <Dir text={statementSnippet(statement, 70)} />
        </div>
        <div className="scroll-y grow">
          <StatementEditor statement={statement} />
        </div>
      </>
    )
  }

  if (narrator) {
    return (
      <>
        <div className="panel-head">
          <span className="label"><span className="label-num">NR</span>Narrator</span>
          <ConsentBadge consent={narrator.identityConsent} />
        </div>
        <div className="scroll-y grow">
          <NarratorEditor narrator={narrator} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="panel-head">
        <span className="label"><span className="label-num">TS</span>Testimony</span>
      </div>
      <div className="scroll-y grow">
        <TestimonyEditor />
      </div>
    </>
  )
}
