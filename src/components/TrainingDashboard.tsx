import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Activity, BarChart3, TrendingUp, Target, RotateCcw, FileText, User, Play, Pause, HelpCircle, X, Italic } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useMemo } from 'react';
import { ProcedureSidebar } from './ProcedureSidebar';

// Web Serial API hook
import { useRef } from 'react';

const POINTS_PER_SECOND = 10;
const WINDOW_SIZE = POINTS_PER_SECOND * 10; // 10 seconds of data
const SIDEBAR_WIDTH = '500px'; // Change this value to adjust sidebar width

// Mock data voor de grafiek
// const generateMockData = () => {
//   const data = [];
//   for (let i = 0; i < 20; i++) {
//     data.push({
//       time: i,
//       angle: 45 + Math.sin(i * 0.5) * 15 + Math.random() * 5,
//       pressure: 60 + Math.cos(i * 0.4) * 20 + Math.random() * 8,
//     });
//   }
//   return data;
// };

// Chart style constants
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'white',
  border: 'none',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const TOOLTIP_LABEL_STYLE = { color: '#1e293b' };

const LEGEND_WRAPPER_STYLE = {
  paddingTop: '0px',
};

// Use smaller dots so the graph looks cleaner (less visual clutter at high sample rates)
const ANGLE_DOT_STYLE = { fill: '#8b5cf6', r: 2 };
const ANGLE_ACTIVE_DOT_STYLE = { r: 4 };

const PRESSURE_DOT_STYLE = { fill: '#06b6d4', r: 2 };
const PRESSURE_ACTIVE_DOT_STYLE = { r: 4 };

export function TrainingDashboard() {
  const [currentAngle, setCurrentAngle] = useState(22.5); // Mock angle for visualization
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [userName] = useState('Dr. Smith'); // Mock user name

  
  const [data, setData] = useState<Array<{time: number; angleR: number; pressure: number; angleP: number; vein: number}>>([]);
  const [isPastInitialPeriod, setIsPastInitialPeriod] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [running, setRunning] = useState(false); // start/pause plotting
  // Use 'any' for SerialPort to avoid TS error
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const [serialLines, setSerialLines] = useState<string[]>([]);
  const bufferRef = useRef<string>(''); // holds partial line between chunks
  const MAX_SERIAL_LINES = 100;
  const serialContainerRef = useRef<HTMLDivElement | null>(null);


  // Check if all steps are completed
  // const allStepsCompleted = completedSteps.size === 5;

  
  // Function to connect to serial port and read data
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API not supported in this browser.');
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setSerialConnected(true);

      // Use the raw reader + TextDecoder for robust streaming
      const reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break; // stream closed
        }
        if (value) {
          // value is a Uint8Array
          const chunk = decoder.decode(value, { stream: true });
          bufferRef.current += chunk;
          const parts = bufferRef.current.split(/\r?\n/);
          const completeLines = parts.slice(0, -1).filter(l => l.length > 0);
          bufferRef.current = parts[parts.length - 1] || '';
          if (completeLines.length > 0) {
            setSerialLines(prev => {
              const next = [...prev, ...completeLines];
              if (next.length > MAX_SERIAL_LINES) {
                const removed = next.length - MAX_SERIAL_LINES;
                const sliced = next.slice(-MAX_SERIAL_LINES);
                // Adjust the processed index so it remains relative to the trimmed buffer.
                // If we removed earlier (old) items then subtract the removed count
                // from lastSerialIndexRef so it still points at the correct next item.
                lastSerialIndexRef.current = Math.max(0, lastSerialIndexRef.current - removed);
                return sliced;
              }
              return next;
            });
            // debug: track how many complete lines we've collected
          }
        }
      }
    } catch (err) {
      alert('Serial connection failed: ' + err);
      setSerialConnected(false);
    }
  };

  // Disconnect/cleanup helper
  const disconnectSerial = async () => {
    try {
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch {}
        readerRef.current.releaseLock?.();
        readerRef.current = null;
      }
      if (portRef.current) {
        try { await portRef.current.close(); } catch {}
        portRef.current = null;
      }
    } finally {
      setSerialConnected(false);
      setRunning(false);
    }
  };

  // Process incoming serial lines and convert to data points
  const lastSerialIndexRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Only process and append plot data while 'running' (after Start pressed)
    if (!running) return;
    if (serialLines.length === 0) return;
    let anyNew = false;
    let latestTime = 0;
    setData(prev => {
      let next = [...prev];
      for (let i = lastSerialIndexRef.current; i < serialLines.length; i++) {
        const line = serialLines[i];
        // Parse format: "angleR:56.53 pressure:80.38 angleP:23.45 vein:1"
        const m = line.match(
          /angleR:\s*([0-9.+-]+)\s+pressure:\s*([0-9.+-]+)\s+angleP:\s*([0-9.+-]+)\s+vein:\s*([01])/i
        );        if (!m) continue;
        // Parse values defensively and validate
        const angleR = Number(m[1]);
        const pressure = Number(m[2]);
        const angleP = Number(m[3]);
        const vein = Number(m[4]);

        // Skip malformed lines instead of letting invalid values propagate
        if (!Number.isFinite(angleR) || !Number.isFinite(pressure) || !Number.isFinite(angleP) || (vein !== 0 && vein !== 1)) {
          continue;
        }
        if (startTimeRef.current === null) startTimeRef.current = Date.now();
        const currentTime = (Date.now() - (startTimeRef.current as number)) / 1000;
        latestTime = Math.max(latestTime, currentTime);
        anyNew = true;
        next.push({ time: currentTime, angleR, pressure, angleP, vein });
      }
      lastSerialIndexRef.current = serialLines.length;
      if (!anyNew) return prev;
      // report that we appended new plot points
      // Cap to WINDOW_SIZE points (rolling 10-second window)
      if (next.length > WINDOW_SIZE) next = next.slice(-WINDOW_SIZE);
      return next;
    });

    if (startTimeRef.current !== null) {
      const simulatedNow = (Date.now() - (startTimeRef.current as number)) / 1000;
      if (simulatedNow > 10 && !isPastInitialPeriod) setIsPastInitialPeriod(true);
      // occasional check to track wall clock progress (every 10s)
      if (Math.floor(simulatedNow) % 10 === 0) {
        /* noop: previously logged session clock for debugging */
      }
    }
  }, [serialLines]);

  // Start/Pause toggle handler
  const toggleRunning = () => {
    if (!serialConnected) return; // can't start when not connected
    if (!running) {
      // Starting: ignore backlog and begin from now
      lastSerialIndexRef.current = serialLines.length;
      startTimeRef.current = Date.now();
      setIsPastInitialPeriod(false);
      setRunning(true);
    } else {
      // Pausing
      setRunning(false);
    }
  };

  // Reset handler: clears graph data, COM output, and resets procedure steps
  const resetSession = () => {
    setData([]);
    startTimeRef.current = null;
    setIsPastInitialPeriod(false);
    // Clear serial lines and buffer
    setSerialLines([]);
    bufferRef.current = '';
    lastSerialIndexRef.current = 0;
    setRunning(false);

    // Reset procedure steps
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSkippedSteps(new Set());
    setFailedSteps(new Set());
  };

  // Clear serial buffer and displayed lines
  const clearSerial = () => {
    bufferRef.current = '';
    setSerialLines([]);
  };

  // Auto-scroll serial container when new lines arrive
  useEffect(() => {
    const el = serialContainerRef.current;
    if (!el) return;
    // Scroll to bottom smoothly
    el.scrollTop = el.scrollHeight;
  }, [serialLines.length]);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [failedSteps, setFailedSteps] = useState<Set<number>>(new Set());
  const [performanceLevel, setPerformanceLevel] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  
  const averageScore = 0.0;

  
  // Check if all steps are completed
  const allStepsCompleted = completedSteps.size === 5;

  // Check if all steps have been processed (completed or failed)
  const allStepsProcessed = (completedSteps.size + failedSteps.size) === 5;



  // Increment session count on mount
  useEffect(() => {
    setSessionCount(prev => prev + 1);
  }, []);

  // Track session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate performance level based on skipped and failed steps
  useEffect(() => {
    const baseScore = 0;
    const penaltyPerSkip = 10;
    const penaltyPerFail = 15;
    const ScorePerCompletion = (100/5);
    // const newScore = Math.max(0, baseScore + (completedSteps.size * penaltyPerSkip) + (completedSteps.size * penaltyPerFail));
    const newScore = Math.round(baseScore + (completedSteps.size * ScorePerCompletion));
    setPerformanceLevel(newScore);
  }, [completedSteps, failedSteps]);



  const handleStepComplete = (stepId: number) => {
    setCompletedSteps(prev => new Set(prev).add(stepId));
    // Move to next step
    if (stepId < 5) {
      setCurrentStep(stepId + 1);
    }
  };

  const handleStepSkipped = (stepId: number) => {
    setSkippedSteps(prev => new Set(prev).add(stepId));
  };

  const handleStepFailed = (stepId: number) => {
    setFailedSteps(prev => new Set(prev).add(stepId));
    // Move to next step
    if (stepId < 5) {
      setCurrentStep(stepId + 1);
    }
  };

  const handleStepBack = (stepId: number) => {
    // Move back one step (but not below 1). Also undo any completion/failed/skipped
    // marks for the step we're returning to so the action buttons are visible again.
    const targetStep = Math.max(1, stepId - 1);
    setCompletedSteps(prev => {
      const s = new Set(prev);
      s.delete(targetStep);
      return s;
    });
    setFailedSteps(prev => {
      const s = new Set(prev);
      s.delete(targetStep);
      return s;
    });
    setSkippedSteps(prev => {
      const s = new Set(prev);
      s.delete(targetStep);
      return s;
    });
    setCurrentStep(targetStep);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSkippedSteps(new Set());
    setFailedSteps(new Set());
    setSessionDuration(0);
    setShowReport(false);
  };

  const getPerformanceLabel = () => {
    if (performanceLevel >= 90) return 'Excellent';
    if (performanceLevel >= 75) return 'Good';
    if (performanceLevel >= 60) return 'Adequate';
    return 'Poor';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate angle and pressure ranges from data
  // Safely compute min/max values — guard against empty data or invalid numbers
  const safeNumberMap = (arr: number[]) => arr.filter(Number.isFinite);
  const anglePValues = safeNumberMap(data.map(d => d.angleP));
  const pressureValues = safeNumberMap(data.map(d => d.pressure));

  const angleMin = anglePValues.length > 0 ? Math.min(...anglePValues).toFixed(1) : '—';
  const angleMax = anglePValues.length > 0 ? Math.max(...anglePValues).toFixed(1) : '—';
  const pressureMin = pressureValues.length > 0 ? Math.min(...pressureValues).toFixed(1) : '—';
  const pressureMax = pressureValues.length > 0 ? Math.max(...pressureValues).toFixed(1) : '—';

  // Calculate angle position for slider - green zone always centered
  const getAnglePosition = (angle: number) => {
    // Green zone is 15-30 degrees, center is at 22.5
    // Map so that 22.5 is at 50%, with reasonable range around it
    const center = 22.5;
    const range = 45; // Total range of ±22.5 from center
    const normalizedAngle = ((angle - center) / range) + 0.5;
    return Math.max(0, Math.min(100, normalizedAngle * 100));
  };

  // Help Modal Component
  const HelpModal = () => (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setShowHelp(false)}
    >
      <Card
        className="border-none shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-slate-900"><strong>Help & Info</strong></CardTitle>
            <button
              onClick={() => setShowHelp(false)}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-6 w-6 text-slate-600" />
            </button>
        </CardHeader>
        <div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-slate-700 text-lg">
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>This interface is part of the <i>VeniSmart Training Kit</i>, a venipuncture 
              training device designed to support medical students as they begin learning 
              intravenous insertion from a safe home environment. It provides reliable feedback 
              to help you build confidence and improve your technique. </li>
              <li>
              You can use this tool however you prefer. The steps for the procedure are listed
              on the left, and you may also practise insertion angle and pressure freely using 
              the graphs and visual indicators on the phantom model.
              </li>
              <li>Disclaimer: This training kit is intended for educational purposes only and should not be used for 
              actual medical procedures. Always follow proper medical guidelines and protocols when performing venipuncture on patients.</li>

            </ol>
          </div>
        </div>
        
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {/* How to Connect Section */}
          <div>
            <h3 className="text-slate-900 font-semibold text-lg mb-2"><strong>Getting Started: Connect the VeniSmart Training Kit</strong></h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-slate-700">
              <p>
                Follow these steps to connect your microcontroller:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>  ➤ Plug in the USB cable into a USB port on your computer.</li>
                <li>
                  ➤ Click the {' '}
                  <button
                    disabled={serialConnected}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200
                      ${serialConnected
                        ? 'bg-gray-200 text-slate-600 cursor-not-allowed'
                        : 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-cyan-300/40'
                      }`}
                  >
                    Connect Device
                  </button> button.
                </li>
                <li>  ➤ Select your device from the list that appears.</li>
                <li>  ➤ Wait for the connection indicator to show <strong>"● Connected"</strong></li>
              </ol>
            </div>
          </div>

          {/* Interface Walkthrough Section */}
          <div>
            <h3 className="text-slate-900 font-semibold text-lg mb-2"><strong>How does the Interface work?</strong></h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-slate-700">
              <p>
                Once connected, the interface will guide you through training steps:
              </p>
              <ol>
                <li>➤ <strong>Procedure Sidebar:</strong> Follow the numbered steps on the left. Click to complete or failed.</li>
                <li>➤ <strong>Real-time Monitoring:</strong> Watch the angle and pressure graphs update in real-time as you practice.</li>
                <li>➤ <strong>Vein insertion:</strong> When the vein has been pierced, an LED indicator will light up.</li>
                <li>➤ <strong>Session Stats:</strong> Track your duration, angle range, and pressure readings throughout the session.</li>
              </ol>
            </div>
          </div>

          {/* Session Controls Section */}
          <div>
            <h3 className="text-slate-900 font-semibold text-lg mb-2"><strong>Session Controls</strong></h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-slate-700">
              <li><strong>Start/Pause:</strong> Begin recording data or pause the session without resetting.</li>
              <li><strong>Reset:</strong> Clear all data and restart from step 1.</li>
              <li><strong>View Report:</strong> Once all steps are completed, view your performance summary.</li>
            </div>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-slate-900 font-semibold text-lg mb-2"><strong>About This Interface</strong></h3>
            <div className="bg-gradient-to-br from-violet-50 to-cyan-50 rounded-lg p-4 space-y-2 text-slate-700">
              <li><strong>Project:</strong> VeniSmart Training Kit</li>
              <li><strong>Purpose:</strong> A medical training device designed to help medical students practice intravenous (IV) insertion techniques through real-time feedback and performance monitoring.</li>
              <li><strong>Credits:</strong> Developed by Bas, Bjorn, Brent and Giofka for the HEE (Health Engineering Expierience) course, by KU Leuven.</li>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Performance Report View
  if (showReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-slate-900 text-4xl">Performance Report</h1>
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => setShowReport(false)}
                variant="outline"
                className="flex items-center gap-2"
              >
                Back to Training
              </Button>
            </div>
          </div>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-slate-900">Session Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Performance Score */}
                <div className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90">Performance Score</span>
                    <Target className="h-5 w-5 text-white/80" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white">{performanceLevel}%</span>
                      <span className="text-white/70">{getPerformanceLabel()}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all"
                        style={{ width: `${performanceLevel}%` }}
                      />
                    </div>
                    {(skippedSteps.size > 0 || failedSteps.size > 0) && (
                      <div className="text-white/80 mt-2 space-y-0.5">
                        {skippedSteps.size > 0 && (
                          <p>{skippedSteps.size} step{skippedSteps.size > 1 ? 's' : ''} skipped</p>
                        )}
                        {failedSteps.size > 0 && (
                          <p>{failedSteps.size} step{failedSteps.size > 1 ? 's' : ''} failed</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Average Performance Score */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90">Average Performance</span>
                    <TrendingUp className="h-5 w-5 text-white/80" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white">{averageScore}%</span>
                    </div>
                    <p className="text-white/80">+0.0% from last month</p>
                  </div>
                </div>

                {/* Session Count */}
                <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90">Session Count</span>
                    <Activity className="h-5 w-5 text-white/80" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white">{sessionCount}</span>
                      <span className="text-white/70">sessions</span>
                    </div>
                    <p className="text-white/80">This month</p>
                  </div>
                </div>
              </div>

              {/* Performance Insights */}
              <div className="border-t pt-6">
                <h3 className="text-slate-900 mb-4">Performance Insights</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2" />
                    <div>
                      <p className="text-slate-900">Consistent pressure control</p>
                      <p className="text-slate-600">Your pressure variance is within optimal range</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-violet-500 mt-2" />
                    <div>
                      <p className="text-slate-900">Angle stability improving</p>
                      <p className="text-slate-600">12% improvement over last week</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Stats */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-slate-900 mb-4">Session Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Duration</span>
                    <span className="text-slate-900">{formatDuration(sessionDuration)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Angle Range</span>
                    <span className="text-slate-900">{angleMin}° - {angleMax}°</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Pressure Range</span>
                    <span className="text-slate-900">{pressureMin} - {pressureMax} mmHg</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showHelp) {
    return <HelpModal />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* {showHelp && <HelpModal />} */}
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-slate-900 text-4xl">VeniSmart Training Kit</h1>
          <div className="flex gap-2 items-center">
            {/* Repoet Button */}
            {allStepsProcessed && (
              <Button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700"
              >
                <FileText className="h-4 w-4" />
                View Report
              </Button>
            )}
            {/* Reset Button */}
            <Button
              onClick={resetSession}
                variant="outline"
                className="flex items-center gap-2"
              >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            {/* Help Button */}
            <Button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-6 w-6 text-violet-600" />
              Help & Info
            </Button>
          </div>
        </div>
        
        {/* Connect / Disconnect Buttons + Start on the right */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={connectSerial}
              disabled={serialConnected}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${serialConnected ? 'bg-gray-200 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-cyan-300/40'}`}
            >
              Connect Device
            </button>

            <button
              onClick={disconnectSerial}
              disabled={!serialConnected}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${serialConnected ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200/40' : 'bg-gray-200 text-slate-600 cursor-not-allowed'}`}
            >
              Disconnect
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Non-pressable connected indicator */}
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${serialConnected ? '"border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"' : 'bg-gray-100 text-slate-600'}`}>
              {serialConnected ? '● Connected' : 'Not connected'}
            </div>

            <button
            onClick={toggleRunning}
            disabled={!serialConnected}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2
              ${running 
                ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white'
                : 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white'
              }`}
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? 'Pause' : 'Start'}
          </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sidebar with Procedure Steps - Fixed with own scroll */}
          <div className="lg:h-[calc(100vh-120px)] lg:sticky lg:top-8 lg:overflow-y-auto">
            <ProcedureSidebar
              onStepComplete={handleStepComplete}
              onStepSkipped={handleStepSkipped}
              onStepFailed={handleStepFailed}
              onStepBack={handleStepBack}
              currentStep={currentStep}
              completedSteps={completedSteps}
              skippedSteps={skippedSteps}
              failedSteps={failedSteps}
              sessionDuration={sessionDuration}
            />
          </div>

          {/* Main Content */}
          <div className="space-y-8 lg:h-[calc(100vh-120px)] lg:sticky lg:top-8 lg:overflow-y-auto">
            
            {/* Angle Monitor and Current Session Stats - Side by side */}
            {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> */}
              {/* Angle Visual Indicator */}
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-slate-900">Optimal angle range: <strong> 15° - 30°</strong></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* <div className="flex justify-center items-center">
                      <span className="text-slate-900 text-4xl">{data.length > 0 ? data[data.length - 1].angleP : 0}°</span>
                    </div> */}
                    
                    {/* Angle Slider with Gradient - Green zone centered */}
                    <div className="relative h-4">
                      {/* Gradient background - green zone in middle */}
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(to right, #ef4444 0%, #eab308 35%, #22c55e 42.5%, #22c55e 57.5%, #eab308 65%, #ef4444 100%)'
                        }}
                      />
                      
                      
                      {/* Pointer */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-slate-900 rounded-full shadow-lg transition-all duration-300"
                        style={{
                          left: `${getAnglePosition(data.length > 0 ? data[data.length - 1].angleR : 0)}%`,
                          transform: `translateX(-50%) translateY(-50%)`
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vein Detection Indicator
              <Card className="border-none shadow-lg">
                <CardContent> 
                  <div className={`mt-4 p-4 rounded-lg border-2 transition-all ${
                    data.length > 0 && data[data.length - 1].vein === 1
                      ? 'bg-emerald-50 border border-emerald-200 rounded-lg p-3'
                      : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${
                        data.length > 0 && data[data.length - 1].vein === 1
                          ? 'bg-red-600 animate-pulse'
                          : 'bg-slate-300'
                      }`} />
                      <span className={`font-bold ${
                        data.length > 0 && data[data.length - 1].vein === 1
                          ? 'text-slate-900 flex-shrink-0'
                          : 'text-slate-600'
                      }`}>
                        Vein {data.length > 0 && data[data.length - 1].vein === 1 ? '● TOUCHING' : '○ Not Touching . . .'}
                      </span>
                    </div>
                  </div>

                </CardContent>
              </Card> */}

              {/* </div> */}

            {/* Angle and Pressure Graph */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-slate-900">Pressure</CardTitle>

                  </div>
                  Vein {data.length > 0 && data[data.length - 1].vein === 1 ? '● TOUCHING' : '○ Not Touching . . .'}

                  {/* <BarChart3 className="h-6 w-6 text-slate-400" /> */}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data}
                      margin={{
                        top: 5,
                        right: 80,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        domain={isPastInitialPeriod ? ['dataMin', 'dataMax'] : [0, 10]}
                        label={{
                          value: 'Time (s)',
                          position: 'insideBottom',
                          offset: -5,
                          fill: '#64748b',
                        }}
                        type="number"
                        tickCount={11}
                      />
                      {/* Left Y-axis for Angle (-90 to 90) */}
                      {/* <YAxis
                        yAxisId="left"
                        stroke="#8b5cf6"
                        domain={[-90, 90]}
                        label={{
                          value: 'Angle (°)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#8b5cf6',
                        }}
                      /> */}
                      {/* Right Y-axis for Pressure (0 to 1) */}
                      <YAxis
                        yAxisId="left"
                        stroke="#06b6d4"
                        domain={[0, 3]}
                        label={{
                          value: 'Pressure',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#06b6d4',
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        labelStyle={{ color: '#1e293b' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {/* <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="angleP"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        name="Angle (°)"
                        dot={{ fill: '#8b5cf6', r: 4 }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      /> */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="pressure"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        name="Pressure"
                        dot={PRESSURE_DOT_STYLE}
                        activeDot={PRESSURE_ACTIVE_DOT_STYLE}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Current Session Stats */}
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-slate-900">Current Session Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Duration</span>
                    <span className="text-slate-900">{formatDuration(sessionDuration)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Angle Range</span>
                    <span className="text-slate-900">{angleMin}° - {angleMax}°</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Pressure Range</span>
                    <span className="text-slate-900">{pressureMin} - {pressureMax} mmHg</span>
                  </div>
                  
                  
                </CardContent>
              </Card>

            {/* Serial Output */}
            <div>
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <CardTitle className="text-slate-900">Serial Output (COM)</CardTitle>
                      <p className="text-slate-600 mt-1 text-sm">Raw incoming serial lines from ESP32</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearSerial}
                        className="px-3 py-1 bg-gray-100 rounded text-sm text-slate-700 hover:bg-gray-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    ref={serialContainerRef}
                    className="max-h-[150px] overflow-y-auto bg-slate-50 rounded p-3 font-mono text-sm text-slate-800"
                  >
                    {!serialConnected ? (
                      <div className="text-slate-500">No serial data yet. Click "Connect Serial" to begin.</div>
                    ) : !running ? (
                      <div className="text-slate-500">Connected. Click "Start" to begin collecting data.</div>
                    ) : (
                      serialLines.slice(lastSerialIndexRef.current).map((line, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
