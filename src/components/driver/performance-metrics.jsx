import { Star, TrendingUp, Award, Target } from "lucide-react";

export function PerformanceMetrics({
  rating = 0,
  completedJobs = 0,
  totalJobs = 0,
  ratings = [],
}) {
  const completionRate =
    totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0;

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-primary/50 text-primary/50" />
        );
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground" />);
      }
    }
    return stars;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="p-6 pb-4">
        <h3 className="text-foreground font-sans flex items-center gap-2 text-lg font-semibold">
          <Award className="h-5 w-5 text-primary" />
          Performance Metrics
        </h3>
      </div>
      <div className="px-6 pb-6 space-y-6">
        {/* Rating Display */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-sans font-bold text-foreground">
              {Number.parseFloat(rating).toFixed(1)}
            </span>
            <div className="flex items-center gap-1">
              {renderStars(Number.parseFloat(rating))}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Average Rating</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-sans font-bold text-foreground">
              {completionRate}%
            </p>
            <p className="text-muted-foreground text-sm">Completion Rate</p>
          </div>

          <div className="bg-muted rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-sans font-bold text-foreground">
              {completedJobs}
            </p>
            <p className="text-muted-foreground text-sm">Jobs Completed</p>
          </div>
        </div>

        {/* Recent Reviews */}
        {ratings && ratings.length > 0 && (
          <div>
            <h4 className="font-medium text-foreground mb-3">Recent Reviews</h4>
            <div className="space-y-3 max-h-32 overflow-y-auto">
              {ratings.slice(0, 3).map((review, index) => (
                <div key={index} className="bg-muted rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {renderStars(review.rating)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-foreground">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Indicators */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">This Month</span>
            <span className="text-primary font-medium">
              {completedJobs} deliveries
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
