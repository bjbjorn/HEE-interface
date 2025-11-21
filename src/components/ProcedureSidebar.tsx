import { useState } from 'react';
import { Card } from './ui/card';
import { CheckCircle2, Circle, AlertCircle, X, Check } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';

interface SubStep {
  id: string;
  label: string;
}

interface Step {
  id: number;
  title: string;
  description: string[];
  subSteps: SubStep[];
}

const PROCEDURE_STEPS: Step[] = [
  {
    id: 1,
    title: 'Patient Preparation and Identification',
    description: [
      'Professional attire (clean clothes, no jewellery, short nails)',
      'Check patient file and present yourself, talk to patient',
      'Disinfect hands with alcohol gel or water and soap',
      'Disinfect work surface',
      'Gather materials: needle, holder, tubes, disinfectants, gloves, tourniquets, sharp container',
    ],
    subSteps: [
      { id: '1-a', label: 'Professional attire (clothes, no jewellery, nails)' },
      { id: '1-b', label: 'Check patient file and present yourself, talk to patient' },
      { id: '1-c', label: 'Disinfect hands' },
      { id: '1-d', label: 'Disinfect surface' },
      { id: '1-e', label: 'Gather materials: needle, holder, tubes, disinfectants, gloves, tourniquets, sharp container' },
    ],
  },
  {
    id: 2,
    title: 'Site Preparation',
    description: [
      'Disinfect hands with alcohol gel or water and soap. Put on non-sterile gloves',
      'Disinfect puncture site, leave at least 15 seconds',
      'Apply the tourniquet max 1 minute 10cm above puncture place, stimulate pumping by patient to select puncture site',
      'Prepare needle & tubes',
    ],
    subSteps: [
      { id: '2-a', label: 'Disinfect hands with alcohol gel or water and soap. Put on non-sterile gloves' },
      { id: '2-b', label: 'Disinfect puncture site, leave at least 15 seconds' },
      { id: '2-c', label: 'Apply the tourniquet max 1 minute 10cm above puncture place, stimulate \'pumping\' by patient to select puncture site' },
      { id: '2-d', label: 'Prepare needle & tubes' },
    ],
  },
  {
    id: 3,
    title: 'Needle Insertion',
    description: [
      'Fixate the arm with non-dominant hand, thumb below puncture site',
      'Let the patient make a fist',
      'Press START to begin monitoring',
      'Insert needle at angle of 15-30°',
    ],
    subSteps: [
      { id: '3-a', label: 'Fixate the arm with non-dominant hand, thumb below puncture site' },
      { id: '3-b', label: 'Let the patient make a fist' },
      { id: '3-c', label: 'Press START to begin monitoring' },
      { id: '3-d', label: 'Insert needle at angle of 15-30°' },
    ],
  },
  {
    id: 4,
    title: 'Blood Collection',
    description: [
      'Insert tube & collect blood',
      'Follow correct collection order',
      'Release tourniquet',
      'Remove needle safely and dispose into a needle container',
      'Press STOP to end monitoring',
      'Apply post-puncture pressure for 3-5min with clean gauze',
      'Label tubes in a correct way',
    ],
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
    description: [
      'Dispose materials and disinfect hands',
      'Position patient',
      'Document all samples and bring to the blood collection centre',
    ],
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
  currentStep: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  failedSteps: Set<number>;
}

export function ProcedureSidebar({
  onStepComplete,
  onStepSkipped,
  onStepFailed,
  currentStep,
  completedSteps,
  skippedSteps,
  failedSteps,
}: ProcedureSidebarProps) {
  const [completedSubSteps, setCompletedSubSteps] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  const handleSubStepToggle = (subStepId: string) => {
    setCompletedSubSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subStepId)) {
        newSet.delete(subStepId);
      } else {
        newSet.add(subStepId);
      }
      return newSet;
    });
  };

  const toggleStepExpanded = (stepId: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

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
    const baseStyles = 'flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer hover:bg-opacity-80';
    
    switch (status) {
      case 'completed':
        return `${baseStyles} bg-emerald-50`;
      case 'failed':
        return `${baseStyles} bg-red-50`;
      case 'skipped':
      case 'missed':
        return `${baseStyles} bg-orange-50`;
      case 'current':
        return `${baseStyles} bg-violet-100 ring-2 ring-violet-400`;
      default:
        return `${baseStyles} bg-slate-50`;
    }
  };

  const getConnectorColor = (stepId: number) => {
    const status = getStepStatus(stepId);
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'failed':
        return 'bg-red-500';
      case 'skipped':
      case 'missed':
        return 'bg-orange-500';
      case 'current':
        return 'bg-violet-500';
      default:
        return 'bg-slate-300';
    }
  };

  return (
    <Card className="border-none shadow-lg p-4 h-fit">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-slate-900">Procedure Steps</h2>
      </div>

      <div className="flex gap-4">
        {/* Vertical Progress bar */}
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

        {/* Steps */}
        <div className="relative flex-1">
          {PROCEDURE_STEPS.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Vertical connector line */}
              {index < PROCEDURE_STEPS.length - 1 && (
                <div className="absolute left-[21px] top-[50px] w-0.5 h-[calc(100%+8px)] bg-slate-200 z-0">
                  {/* Progress fill based on next step status */}
                  {(completedSteps.has(step.id + 1) || failedSteps.has(step.id + 1) || skippedSteps.has(step.id + 1)) && (
                    <div className={`w-full h-full ${getConnectorColor(step.id + 1)}`} />
                  )}
                </div>
              )}

              {/* Step content */}
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
                          (Press START)
                        </span>
                      )}
                      {step.id === 4 && (
                        <span className="text-red-600">
                          (Press STOP)
                        </span>
                      )}
                      {skippedSteps.has(step.id) && (
                        <span className="text-orange-600">
                          (Skipped)
                        </span>
                      )}
                      {failedSteps.has(step.id) && (
                        <span className="text-red-600">
                          (Failed)
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 break-words">
                      {step.title}
                    </p>
                  </div>
                </div>

                {/* Sub-steps */}
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

                {/* Action buttons for current step */}
                {step.id === currentStep && !completedSteps.has(step.id) && !failedSteps.has(step.id) && (
                  <div className="ml-9 mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => onStepComplete(step.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                      onClick={() => onStepFailed(step.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Failed
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