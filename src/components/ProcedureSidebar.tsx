import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { CheckCircle2, Circle, AlertCircle, X, Check, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Switch } from './ui/switch';

interface SubStep {
  id: string;
  label: string;
}

interface Step {
  id: number;
  title: string;
  subSteps: SubStep[];
}

const PROCEDURE_STEPS: Step[] = [
  {
    id: 1,
    title: 'Patient Preparation and Identification',
    subSteps: [
      { id: '1-a', label: 'Gather materials: needle, holder, tubes, disinfectants, gloves, tourniquets, sharp container' },
      { id: '1-b', label: 'Check patient file and present yourself, talk to patient' },
      { id: '1-c', label: 'Disinfect hands' },
      { id: '1-d', label: 'Disinfect surface' },
      { id: '1-e', label: 'Professional attire (clothes, no jewellery, nails)' },
    ],
  },
  {
    id: 2,
    title: 'Site Preparation',
    subSteps: [
      { id: '2-a', label: 'Disinfect hands with alcohol gel or water and soap. Put on non-sterile gloves' },
      { id: '2-b', label: 'Disinfect puncture site, leave at least 15 seconds' },
      { id: '2-c', label: 'Apply the tourniquet max 1 minute 10cm above puncture place, stimulate "pumping" by patient to select puncture site' },
      { id: '2-d', label: 'Prepare needle & tubes' },
    ],
  },
  {
    id: 3,
    title: 'Needle Insertion',
    subSteps: [
      { id: '3-a', label: 'Fixate the arm with non-dominant hand, thumb below puncture site' },
      { id: '3-b', label: 'Let the patient make a fist' },
      { id: '3-c', label: 'Insert needle at angle of 15-30°' },
      { id: '3-d', label: 'Press START to begin monitoring' },
    ],
  },
  {
    id: 4,
    title: 'Blood Collection',
    subSteps: [
      { id: '4-a', label: 'Insert tube & collect' },
      { id: '4-b', label: 'Follow collection order' },
      { id: '4-c', label: 'Release tourniquet' },
      { id: '4-d', label: 'Remove needle safely and dispose into a needle container' },
      { id: '4-e', label: 'Press STOP to end monitoring' },
      { id: '4-f', label: 'Apply post-puncture pressure for 3-5min with clean gauze' },
      { id: '4-g', label: 'Label tubes in a correct way' },
    ],
  },
  {
    id: 5,
    title: 'Aftercare',
    subSteps: [
      { id: '5-a', label: 'Dispose materials and disinfect hands' },
      { id: '5-b', label: 'Position patient' },
      { id: '5-c', label: 'Document all samples and bring to the blood collection centre' },
    ],
  },
];

interface ProcedureSidebarProps {
  onStepComplete: (stepId: number) => void;
  onStepSkipped: (stepId: number) => void;
  onStepFailed: (stepId: number) => void;
  onStepBack: (stepId: number) => void;
  currentStep: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  failedSteps: Set<number>;
  sessionDuration: number;
}

export function ProcedureSidebar({
  onStepComplete,
  onStepSkipped,
  onStepFailed,
  onStepBack,
  currentStep,
  completedSteps,
  skippedSteps,
  failedSteps,
  sessionDuration,
}: ProcedureSidebarProps) {
  const [completedSubSteps, setCompletedSubSteps] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  // NEW: duration in seconds (10,20,30) or null for None
  const [autoContinueDuration, setAutoContinueDuration] = useState<number | null>(null);
  const [countdownStartTime, setCountdownStartTime] = useState<number | null>(null);

  const handleSubStepToggle = (subStepId: string) => {
    setCompletedSubSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subStepId)) newSet.delete(subStepId);
      else newSet.add(subStepId);
      return newSet;
    });
  };

  const toggleStepExpanded = (stepId: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) newSet.delete(stepId);
      else newSet.add(stepId);
      return newSet;
    });
  };

  // ✔️ UPDATED: Countdown uses selected auto-continue duration
  const countdownTimer =
    countdownStartTime !== null && autoContinueDuration
      ? Math.max(0, autoContinueDuration - (sessionDuration - countdownStartTime))
      : 0;

  // ✔️ If countdown reaches zero, auto advance
  useEffect(() => {
    if (
      countdownStartTime !== null &&
      autoContinueDuration &&
      countdownTimer === 0
    ) {
      if (currentStep < 5) {
        onStepComplete(currentStep);
      }
      setCountdownStartTime(null);
    }
  }, [countdownTimer, countdownStartTime, autoContinueDuration, currentStep, onStepComplete]);

  // ✔️ Start countdown when selecting a duration, stop when selecting None
  useEffect(() => {
    if (autoContinueDuration && countdownStartTime === null) {
      setCountdownStartTime(sessionDuration);
    }
    if (!autoContinueDuration) {
      setCountdownStartTime(null);
    }
  }, [autoContinueDuration, sessionDuration]);

  // Expand only current step
  useEffect(() => {
    setExpandedSteps(new Set([currentStep]));
  }, [currentStep]);

  const getStepStatus = (stepId: number) => {
    if (failedSteps.has(stepId)) return 'failed';
    if (completedSteps.has(stepId)) return 'completed';
    if (skippedSteps.has(stepId)) return 'skipped';
    if (stepId === currentStep) return 'current';
    if (stepId < currentStep) return 'missed';
    return 'upcoming';
  };

  const getStepIcon = (stepId: number) => {
    const status = getStepStatus(stepId);
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
      case 'failed':
        return <X className="h-6 w-6 text-red-600 stroke-[3]" />;
      case 'skipped':
      case 'missed':
        return <AlertCircle className="h-6 w-6 text-orange-500" />;
      case 'current':
        return <Circle className="h-6 w-6 text-violet-500 fill-violet-500" />;
      default:
        return <Circle className="h-6 w-6 text-slate-300" />;
    }
  };

  const getStepStyles = (stepId: number) => {
    const status = getStepStatus(stepId);
    const base = 'flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer hover:bg-opacity-80';
    switch (status) {
      case 'completed': return `${base} bg-emerald-50`;
      case 'failed': return `${base} bg-red-50`;
      case 'skipped':
      case 'missed': return `${base} bg-orange-50`;
      case 'current': return `${base} bg-violet-100 ring-2 ring-violet-400`;
      default: return `${base} bg-slate-50`;
    }
  };

  const getConnectorColor = (stepId: number) => {
    const status = getStepStatus(stepId);
    switch (status) {
      case 'completed': return 'bg-emerald-500';
      case 'failed': return 'bg-red-500';
      case 'skipped':
      case 'missed': return 'bg-orange-500';
      case 'current': return 'bg-violet-500';
      default: return 'bg-slate-300';
    }
  };

  const handleCompleteWithAutoCountdown = (stepId: number) => {
    if (autoContinueDuration) {
      setCountdownStartTime(sessionDuration);
    } else {
      onStepComplete(stepId);
    }
  };

  return (
    <Card className="border-none shadow-lg p-4 h-fit">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-slate-900">Procedure Steps</h2>

        {countdownTimer > 0 && (
          <p className="text-sm text-slate-600">
            Auto-Continuing in {countdownTimer}s
          </p>
        )}

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Auto continue
            <select
              value={autoContinueDuration ? autoContinueDuration : "None"}
              onChange={(e) => {
                const value = e.target.value;

                if (value === "None") {
                  setAutoContinueDuration(null);
                  setCountdownStartTime(null);
                  return;
                }

                const seconds = Number(value);
                setAutoContinueDuration(seconds);
                setCountdownStartTime(sessionDuration);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="None">None</option>
              <option value="10">10s</option>
              <option value="20">20s</option>
              <option value="30">30s</option>
            </select>
          </label>
        </div>
      </div>

      {/* --- Rest of your component remains identical --- */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center py-2">
          <div className="relative h-[400px] w-1.5 bg-slate-200 rounded-full">
            <div
              className="absolute top-0 w-full bg-violet-500 rounded-full transition-all"
              style={{ height: `${(completedSteps.size / 5) * 100}%` }}
            />
          </div>
          <span className="text-slate-600 mt-2">
            {completedSteps.size}/{PROCEDURE_STEPS.length}
          </span>
        </div>

        <div className="relative flex-1">
          {PROCEDURE_STEPS.map((step, index) => (
            <div key={step.id} className="relative">
              {index < PROCEDURE_STEPS.length - 1 && (
                <div className="absolute left-[21px] top-[50px] w-0.5 h-[calc(100%+8px)] bg-slate-200 z-0">
                  {(completedSteps.has(step.id + 1) ||
                    failedSteps.has(step.id + 1) ||
                    skippedSteps.has(step.id + 1)) && (
                    <div className={`w-full h-full ${getConnectorColor(step.id + 1)}`} />
                  )}
                </div>
              )}

              <div className="relative z-10 mb-2">
                <div
                  className={getStepStyles(step.id)}
                  onClick={() => toggleStepExpanded(step.id)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step.id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-900 flex-shrink-0">
                        Step {step.id}
                      </span>
                      {step.id === 3 && (
                        <span className="text-emerald-600">
                          (Press START after completing all steps)
                        </span>
                      )}
                      {step.id === 4 && (
                        <span className="text-red-600">
                          (After the needle insertion)
                        </span>
                      )}
                      {skippedSteps.has(step.id) && (
                        <span className="text-orange-600">(Skipped)</span>
                      )}
                      {failedSteps.has(step.id) && (
                        <span className="text-red-600">(Failed)</span>
                      )}
                    </div>
                    <p className="text-slate-700 break-words">
                      {step.title}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {expandedSteps.has(step.id) ? (
                      <ChevronUp className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                </div>

                {expandedSteps.has(step.id) && (
                  <div className="ml-9 mt-2 space-y-1.5 mb-2">
                    {step.subSteps.map((subStep) => (
                      <div
                        key={subStep.id}
                        className="flex items-center gap-2 p-2 bg-white rounded hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          id={subStep.id}
                          checked={completedSubSteps.has(subStep.id)}
                          onCheckedChange={() => handleSubStepToggle(subStep.id)}
                          className="border-slate-300"
                        />
                        <label
                          htmlFor={subStep.id}
                          className="text-slate-700 cursor-pointer flex-1"
                        >
                          {subStep.label}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {step.id === currentStep &&
                  !completedSteps.has(step.id) &&
                  !failedSteps.has(step.id) && (
                    <div className="ml-9 mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ flex: 4 }}
                        className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleCompleteWithAutoCountdown(step.id)}
                        disabled={!!autoContinueDuration}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Continue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ flex: 1 }}
                        className="border-slate-300 text-slate-700 hover:bg-slate-100"
                        onClick={() => onStepBack(step.id)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
