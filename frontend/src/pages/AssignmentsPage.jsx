/**
 * AssignmentsPage – dual-purpose page:
 *   - Students see their assigned lines and can start training them
 *   - Teachers/admins can assign lines to students and see given assignments
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  fetchMyAssignments,
  fetchGivenAssignments,
  fetchAssignableStudents,
  fetchRepertoires,
  createAssignment,
  completeAssignment,
  deleteAssignment,
} from '../api/trainerApi'

export default function AssignmentsPage() {
  const { isAdmin, isTeacher, isStudent } = useAuth()
  const navigate = useNavigate()
  const canAssign = isAdmin || isTeacher

  /* ── Shared state ── */
  const [myAssignments, setMyAssignments] = useState([])
  const [givenAssignments, setGivenAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(canAssign ? 'assign' : 'my')

  /* ── Assign form state ── */
  const [students, setStudents] = useState([])
  const [repertoires, setRepertoires] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedRepertoire, setSelectedRepertoire] = useState('')
  const [selectedLine, setSelectedLine] = useState('')
  const [assignNote, setAssignNote] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const promises = [fetchMyAssignments()]
      if (canAssign) {
        promises.push(fetchGivenAssignments())
        promises.push(fetchAssignableStudents())
        promises.push(fetchRepertoires())
      }
      const results = await Promise.all(promises)
      setMyAssignments(results[0].data.assignments || [])
      if (canAssign) {
        setGivenAssignments(results[1].data.assignments || [])
        setStudents(results[2].data.students || [])
        setRepertoires(results[3].data.repertoires || [])
      }
    } catch {
      toast.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  /* ── Get lines for a selected repertoire ── */
  const selectedRep = repertoires.find((r) => r.id === selectedRepertoire)
  const lines = selectedRep?.lines || []

  /* ── Assign handler ── */
  const handleAssign = async () => {
    if (!selectedStudent || !selectedRepertoire || selectedLine === '') {
      toast.error('Select student, opening, and line')
      return
    }
    try {
      await createAssignment(
        Number(selectedStudent),
        selectedRepertoire,
        Number(selectedLine),
        assignNote,
      )
      toast.success('Line assigned!')
      setSelectedStudent('')
      setSelectedRepertoire('')
      setSelectedLine('')
      setAssignNote('')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign')
    }
  }

  const handleComplete = async (id) => {
    try {
      await completeAssignment(id)
      toast.success('Assignment completed')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to complete')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAssignment(id)
      toast.success('Assignment deleted')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleTrain = (a) => {
    navigate(`/train?id=${a.repertoire_id}&line=${a.line_index}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="spinner" />
      </div>
    )
  }

  const tabs = []
  if (canAssign) tabs.push('assign', 'given')
  tabs.push('my')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">Assignments</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
              tab === t
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {t === 'my' ? 'My Assignments' : t === 'given' ? 'Given' : 'Assign Line'}
          </button>
        ))}
      </div>

      {/* ── Assign Tab (teacher/admin) ── */}
      {tab === 'assign' && canAssign && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Assign a Line to a Student</h2>

          {/* Student select */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="input-field"
            >
              <option value="">Select student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          {/* Opening select */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Opening</label>
            <select
              value={selectedRepertoire}
              onChange={(e) => {
                setSelectedRepertoire(e.target.value)
                setSelectedLine('')
              }}
              className="input-field"
            >
              <option value="">Select opening...</option>
              {repertoires.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.opening} ({r.category})
                </option>
              ))}
            </select>
          </div>

          {/* Line select */}
          {selectedRepertoire && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Specific Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="input-field"
              >
                <option value="">Select line...</option>
                {lines.map((l, idx) => (
                  <option key={idx} value={idx}>
                    {l.line_name} ({l.move_count} moves)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Note (optional)</label>
            <input
              type="text"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Practice this before our next session..."
              className="input-field"
            />
          </div>

          <button onClick={handleAssign} className="btn-primary">
            Assign Line
          </button>
        </div>
      )}

      {/* ── Given Tab (teacher sees what they assigned) ── */}
      {tab === 'given' && canAssign && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {givenAssignments.length} assignment{givenAssignments.length !== 1 ? 's' : ''} given
          </p>
          {givenAssignments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No assignments given yet.</p>
          ) : (
            givenAssignments.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                showStudent
                onDelete={() => handleDelete(a.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── My Assignments Tab (student view) ── */}
      {tab === 'my' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {myAssignments.length} assignment{myAssignments.length !== 1 ? 's' : ''}
          </p>
          {myAssignments.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl mb-3 block">📋</span>
              <p className="text-gray-500">No assignments yet.</p>
            </div>
          ) : (
            myAssignments.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                showTeacher
                onTrain={() => handleTrain(a)}
                onComplete={a.status === 'pending' ? () => handleComplete(a.id) : null}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ── Assignment card component ── */
function AssignmentCard({ assignment: a, showStudent, showTeacher, onTrain, onComplete, onDelete }) {
  const statusStyle = a.status === 'completed'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'

  return (
    <div className="card p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{a.line_name}</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${statusStyle}`}
            >
              {a.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Opening: {a.repertoire_id.replace(/_/g, ' ')}
          </p>
          {showStudent && (
            <p className="text-xs text-gray-600 mt-1">
              Student: {a.student_name}
            </p>
          )}
          {showTeacher && (
            <p className="text-xs text-gray-600 mt-1">
              Assigned by: {a.assigned_by_name}
            </p>
          )}
          {a.note && (
            <p className="text-xs text-blue-400 mt-1 italic">"{a.note}"</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 sm:ml-3">
          {onTrain && a.status === 'pending' && (
            <button onClick={onTrain} className="btn-primary text-xs py-1.5 px-3">
              Train
            </button>
          )}
          {onComplete && (
            <button onClick={onComplete} className="btn-secondary text-xs py-1.5 px-3">
              Mark Done
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
