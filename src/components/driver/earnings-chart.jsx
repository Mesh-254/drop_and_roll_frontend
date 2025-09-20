import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export function EarningsChart({ earnings, detailed = false }) {
  const doughnutData = {
    labels: ["Today", "This Week", "This Month"],
    datasets: [
      {
        data: [
          earnings.today || 0,
          earnings.weekly || 0,
          earnings.monthly || 0,
        ],
        backgroundColor: ["#FF6600", "#FFB74D", "#FFA726"],
        borderColor: ["#E55A00", "#FF9800", "#FF8F00"],
        borderWidth: 2,
      },
    ],
  };

  const barData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Daily Earnings (KES)",
        data: earnings.chartData?.map((d) => d.amount) || [
          2100, 2800, 2200, 3100, 2900, 1800, 2450,
        ],
        backgroundColor: "#34D399",
        borderColor: "#10B981",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
          color: "#6B7280",
        },
      },
      tooltip: {
        backgroundColor: "#1F2937",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        borderColor: "#374151",
        borderWidth: 1,
        callbacks: {
          label: (context) => `KES ${context.parsed.toLocaleString()}`,
        },
      },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: "#6B7280",
          callback: (value) => `KES ${value.toLocaleString()}`,
        },
        grid: {
          color: "#E5E7EB",
        },
      },
      x: {
        ticks: {
          color: "#6B7280",
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="p-6 pb-4">
        <h3 className="text-foreground font-sans text-lg font-semibold">
          {detailed ? "Weekly Earnings Trend" : "Earnings Breakdown"}
        </h3>
      </div>
      <div className="px-6 pb-6">
        <div className="h-64">
          {detailed ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <Doughnut data={doughnutData} options={chartOptions} />
          )}
        </div>
        {!detailed && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-sans font-bold text-primary">
                KES {earnings.today?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
            <div>
              <p className="text-2xl font-sans font-bold text-secondary">
                KES {earnings.weekly?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
            <div>
              <p className="text-2xl font-sans font-bold text-chart-2">
                KES {earnings.monthly?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">This Month</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
