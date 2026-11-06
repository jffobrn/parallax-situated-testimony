import { useStore } from '../state/store'
import { ConsentBadge, Dir, roleLabel } from '../components/ui'
import { narratorOf, statementSnippet } from '../lib/derive'
import { StatementEditor } from './StatementEditor'
import { NarratorEditor } from './NarratorEditor'
import { CameraPanel } from './MeetingPlace'
import { allCameras } from '../lib/cameras'
import { TestimonyEditor } from './TestimonyEditor'

function PaneHead({ where }: { where: string }) {
  return (
    <div className="pane-head">
      <span>Properties</span>
      <span className="faint" style={{ fontWeight: 400 }}>{where}</span>
    </div>
  )
}

/**
 * The inspector shows one of three things, in priority order: the selected
 * statement, the selected narrator, or (the home state) the testimony identity.
 */
export function Inspector() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const selectedNarratorId = useStore((s) => s.selectedNarratorId)
  const selectedCameraId = useStore((s) => s.selectedCameraId)

  const statement = selectedStatementId
    ? project.statements.find((s) => s.id === selectedStatementId)
    : undefined
  const narrator = selectedNarratorId
    ? project.testimony.narrators.find((n) => n.id === selectedNarratorId)
    : undefined

  const cams = allCameras(project.testimony)
  const camHit = selectedCameraId ? cams.find((c) => c.camera.id === selectedCameraId) : undefined
  if (camHit) {
    return (
      <>
        <PaneHead where={`Camera ${cams.indexOf(camHit) + 1} of ${cams.length}`} />
        <div className="inspector-head">
          <div className="kicker">
            <span>Camera, from {camHit.set.tool === 'atlas' ? 'Atlas' : 'Sightlines'}</span>
            <ConsentBadge consent={camHit.camera.consent} />
          </div>
          <div className="inspector-title">
            <Dir text={camHit.camera.label} />
          </div>
        </div>
        <div className="scroll-y grow">
          <CameraPanel key={camHit.camera.id} camera={camHit.camera} />
        </div>
      </>
    )
  }

  if (statement) {
    const by = narratorOf(project, statement)
    return (
      <>
        <PaneHead where={`Statement ${project.statements.indexOf(statement) + 1} of ${project.statements.length}`} />
        <div className="inspector-head">
          <div className="kicker">
            <span>
              Statement{by ? ', ' : ''}
              {by && <Dir text={`by ${by.name?.trim() || 'an unnamed narrator'}`} />}
            </span>
            <ConsentBadge consent={statement.consent} />
          </div>
          <div className="inspector-title">
            <Dir text={statementSnippet(statement, 70)} />
          </div>
        </div>
        <div className="scroll-y grow">
          <StatementEditor key={statement.id} statement={statement} />
        </div>
      </>
    )
  }

  if (narrator) {
    return (
      <>
        <PaneHead
          where={`Narrator ${project.testimony.narrators.indexOf(narrator) + 1} of ${project.testimony.narrators.length}`}
        />
        <div className="inspector-head">
          <div className="kicker">
            <span>Narrator, {roleLabel(narrator.role).toLowerCase()}</span>
            <ConsentBadge consent={narrator.identityConsent} />
          </div>
          <div className="inspector-title">
            <Dir text={narrator.name?.trim() || 'Unnamed narrator'} />
          </div>
        </div>
        <div className="scroll-y grow">
          <NarratorEditor key={narrator.id} narrator={narrator} />
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHead where="Testimony" />
      <div className="scroll-y grow">
        <TestimonyEditor />
      </div>
    </>
  )
}
