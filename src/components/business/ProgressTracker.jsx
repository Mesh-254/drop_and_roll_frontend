import React from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

const ProgressTracker = ({ 
  currentStep = 0, 
  steps = [],
  status = 'in_progress'
}) => {
  const getStepIcon = (step, index) => {
    if (index < currentStep) {
      return <Check className="h-5 w-5 text-foreground" />;
    }
    if (index === currentStep) {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Clock className="h-5 w-5 text-foreground" />
        </motion.div>
      );
    }
    return <div className="h-2 w-2 bg-surface-hover rounded-full" />;
  };

  const getStepStatus = (index) => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'active';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center flex-1"
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                  getStepStatus(index) === 'completed'
                    ? 'bg-success'
                    : getStepStatus(index) === 'active'
                    ? 'bg-primary shadow-lg shadow-primary/50'
                    : 'bg-surface-hover'
                }`}
              >
                {getStepIcon(step, index)}
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground text-center">
                {step.label}
              </p>
            </motion.div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: index * 0.1 + 0.1, duration: 0.4 }}
                className={`h-1 flex-1 mx-2 rounded-full origin-left ${
                  index < currentStep
                    ? 'bg-success'
                    : 'bg-surface-hover'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Status Info */}
      {status && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`flex items-center gap-2 text-sm font-medium ${
            status === 'completed'
              ? 'text-success'
              : status === 'error'
              ? 'text-destructive'
              : 'text-brand-text'
          }`}
        >
          {status === 'completed' ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Process completed successfully</span>
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>Process encountered errors</span>
            </>
          ) : (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
                <Clock className="h-4 w-4" />
              </motion.div>
              <span>Processing in progress</span>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProgressTracker;
