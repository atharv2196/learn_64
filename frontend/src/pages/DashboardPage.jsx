/**
 * DashboardPage – user progress view.
 */
import ProgressDashboard from '../components/ProgressDashboard'

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">My Progress</h1>
      <ProgressDashboard />
    </div>
  )
}
