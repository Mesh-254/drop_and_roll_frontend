import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileUp,
  TrendingUp,
  DollarSign,
  Plus,
  Loader2,
  Eye,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useBulkUpload } from '../../hooks/useBulkUpload';
import BulkUploadWizard from './BulkUploadWizard';

/**
 * BulkUploadDashboard — main dashboard for bulk uploads.
 *
 * Shows:
 * - 4-card stats (Total Uploads, Bookings Created, Success Rate, Total Spend)
 * - Recent uploads history with status filtering
 * - Modal-based upload flow via BulkUploadWizard (which handles BusinessProfile modal)
 * - Role-based approval check
 */
export default function BulkUploadDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isApproved = auth?.user?.is_approved ?? true;

  const {
    stats,
    isFetchingStats,
    fetchStats,
    uploads,
    isFetchingUploads,
    fetchUploads,
  } = useBulkUpload();

  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('all');

  // Fetch data on mount
  useEffect(() => {
    fetchStats();
    fetchUploads(1);
  }, [fetchStats, fetchUploads]);

  // Filter uploads by status
  const filteredUploads =
    statusFilter === 'all' ? uploads : uploads.filter((u) => u.status === statusFilter);

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Your account has not yet been approved for bulk uploads. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              Bulk Upload
            </h1>
            <p className="text-slate-400">
              Manage and track your bulk shipments efficiently
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-300 flex items-center gap-2 shadow-lg shadow-orange-500/25 w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            New Upload
          </motion.button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {/* Total Uploads */}
          <StatCard
            icon={FileUp}
            label="Total Uploads"
            value={stats?.total_uploads ?? 0}
            isLoading={isFetchingStats}
          />

          {/* Bookings Created */}
          <StatCard
            icon={BarChart3}
            label="Bookings Created"
            value={stats?.total_bookings ?? 0}
            trend={stats?.bookings_trend_pct}
            isLoading={isFetchingStats}
          />

          {/* Success Rate */}
          <StatCard
            icon={TrendingUp}
            label="Success Rate"
            value={`${stats?.success_rate_pct ?? 0}%`}
            trend={stats?.success_trend_pct}
            isLoading={isFetchingStats}
          />

          {/* Total Spend */}
          <StatCard
            icon={DollarSign}
            label="Total Spend"
            value={`£${(stats?.total_spend_gbp ?? 0).toFixed(2)}`}
            isLoading={isFetchingStats}
          />
        </motion.div>

        {/* Upload History Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Uploads</h2>
              <p className="text-sm text-slate-400 mt-1">
                Track your upload history and performance
              </p>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-5 w-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 min-h-96">
            {isFetchingUploads ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-slate-400">Loading uploads...</p>
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileUp className="h-8 w-8 text-orange-400" />
                </div>
                <p className="text-white mb-4 font-medium">
                  No uploads yet
                </p>
                <p className="text-slate-400 mb-6">
                  Start by uploading your first batch!
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowUploadModal(true)}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Upload
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUploads.map((upload) => (
                  <UploadHistoryRow
                    key={upload.id}
                    upload={upload}
                    onViewDetail={() => navigate(`/bulk-uploads/${upload.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Upload Flow Modal (using BulkUploadWizard which handles BusinessProfile modal) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <BulkUploadWizard
              onSuccess={() => {
                setShowUploadModal(false);
                fetchUploads(1);
                fetchStats();
              }}
              onClose={() => setShowUploadModal(false)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

/**
 * StatCard component
 */
function StatCard({ icon: Icon, label, value, trend, isLoading }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      className="relative group bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 hover:border-orange-500/50 transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 font-medium mb-2">{label}</p>
          <motion.p
            key={value}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold text-white"
          >
            {isLoading ? '—' : value}
          </motion.p>
          {trend !== undefined && trend !== null && (
            <p
              className={`text-xs mt-3 font-medium flex items-center gap-1 ${
                trend > 0
                  ? 'text-green-400'
                  : 'text-slate-500'
              }`}
            >
              {trend > 0 ? '↑' : '→'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>

        <div className="p-3 bg-orange-500/20 rounded-xl group-hover:bg-orange-500/30 transition-all duration-300">
          <Icon className="h-6 w-6 text-orange-400" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * UploadHistoryRow component
 */
function UploadHistoryRow({ upload, onViewDetail }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-900/30',
          text: 'text-green-300',
          dot: 'bg-green-500',
          label: 'Completed',
        };
      case 'processing':
        return {
          bg: 'bg-blue-900/30',
          text: 'text-blue-300',
          dot: 'bg-blue-500',
          label: 'Processing',
        };
      case 'failed':
        return {
          bg: 'bg-red-900/30',
          text: 'text-red-300',
          dot: 'bg-red-500',
          label: 'Failed',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-900/30',
          text: 'text-yellow-300',
          dot: 'bg-yellow-500',
          label: 'Pending',
        };
      case 'partial':
        return {
          bg: 'bg-yellow-900/30',
          text: 'text-yellow-300',
          dot: 'bg-yellow-500',
          label: 'Partial',
        };
      default:
        return {
          bg: 'bg-slate-700/30',
          text: 'text-slate-300',
          dot: 'bg-slate-500',
          label: 'Unknown',
        };
    }
  };

  const status = getStatusColor(upload.status);
  const successRate =
    upload.total_rows > 0 ? Math.round((upload.successful / upload.total_rows) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group bg-slate-700/30 hover:bg-slate-700/50 rounded-xl border border-slate-700 p-4 transition-all duration-300 cursor-pointer"
      onClick={onViewDetail}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left side: name & status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full ${status.dot}`}></div>
            <h4 className="text-white font-semibold truncate">
              {upload.batch_name || 'Unnamed Batch'}
            </h4>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.bg} ${status.text} whitespace-nowrap`}>
              {status.label}
            </span>
          </div>

          {/* Metrics row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mb-2">
            <span>{upload.total_rows} rows total</span>
            <span>•</span>
            <span className="text-green-400">{upload.successful} successful</span>
            {upload.total_rows > 0 && (
              <>
                <span>•</span>
                <span>Success rate: {successRate}%</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-600 rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${successRate}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
            ></motion.div>
          </div>
        </div>

        {/* Right side: date & button */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail();
            }}
            className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            View
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
