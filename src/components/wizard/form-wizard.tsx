"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, CalendarIcon, Loader2, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNextAllowedDate } from '@/hooks/use-next-allowed-date';

// Wizard Step Types
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<Record<string, unknown>>;
  isCompleted?: boolean;
  isOptional?: boolean;
}

// Types for persistent data
export interface AddedExpense {
  id?: string;
  tempId?: string;
  description?: string;
  amount: number;
  date: Date;
  expenseCategoryId: string;
  bankId?: string;
}

export interface AddedCredit {
  id?: string;
  tempId?: string;
  customerId: string;
  fuelType: string;
  quantity?: number;
  amount: number;
  date: Date;
}

export interface AddedDeposit {
  id?: string;
  tempId?: string;
  bankId: string;
  amount: number;
  date: Date;
}

export interface AddedProduct {
  id?: string;
  tempId?: string;
  date: Date;
  productType: string;
  quantity?: number;
  price: number;
}

export interface AddedPayment {
  id?: string;
  tempId?: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paidOn: Date;
}

// Wizard Context
interface WizardContextType {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  markStepCompleted: (stepIndex: number) => void;
  markCurrentStepCompleted: () => void;
  isStepCompleted: (stepIndex: number) => boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLastStep: boolean;
  isFirstStep: boolean;
  onSaveAndNext: (() => (() => Promise<boolean>)) | null;
  setOnSaveAndNext: (handler: (() => (() => Promise<boolean>)) | null) => void;
  isStepDisabled: boolean;
  setIsStepDisabled: (disabled: boolean) => void;
  isCurrentStepCompleted: boolean;
  setIsCurrentStepCompleted: (completed: boolean) => void;
  // Common date for all steps
  commonDate: Date;
  setCommonDate: React.Dispatch<React.SetStateAction<Date>>;
  // Branch selection
  selectedBranchId: string;
  setSelectedBranchId: React.Dispatch<React.SetStateAction<string>>;
  userRole?: string;
  userBranchId?: string;
  // Pump closed flag
  isPumpClosed: boolean;
  setIsPumpClosed: React.Dispatch<React.SetStateAction<boolean>>;
  // Persistent data across steps
  addedExpenses: AddedExpense[];
  setAddedExpenses: React.Dispatch<React.SetStateAction<AddedExpense[]>>;
  addedCredits: AddedCredit[];
  setAddedCredits: React.Dispatch<React.SetStateAction<AddedCredit[]>>;
  addedDeposits: AddedDeposit[];
  setAddedDeposits: React.Dispatch<React.SetStateAction<AddedDeposit[]>>;
  addedProducts: AddedProduct[];
  setAddedProducts: React.Dispatch<React.SetStateAction<AddedProduct[]>>;
  addedPayments: AddedPayment[];
  setAddedPayments: React.Dispatch<React.SetStateAction<AddedPayment[]>>;
  // Saved records count
  savedRecords: { [key: string]: number };
  setSavedRecords: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

// Wizard Provider Props
interface WizardProviderProps {
  children: React.ReactNode;
  steps: WizardStep[];
  onComplete?: () => void;
  onStepChange?: (step: number) => void;
  initialBranchId?: string;
  userRole?: string;
  userBranchId?: string;
}

export const WizardProvider: React.FC<WizardProviderProps> = ({
  children,
  steps,
  onComplete,
  onStepChange,
  initialBranchId,
  userRole,
  userBranchId,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [onSaveAndNext, setOnSaveAndNext] = useState<(() => (() => Promise<boolean>)) | null>(null);
  const [isStepDisabled, setIsStepDisabled] = useState(false);
  const [isCurrentStepCompleted, setIsCurrentStepCompleted] = useState(false);
  const [isPumpClosed, setIsPumpClosed] = useState(false);
  
  // Branch selection state
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    // For non-admin users, use their assigned branch
    if (userRole?.toLowerCase() !== 'admin' && userBranchId) {
      return userBranchId;
    }
    // For admin users, use the initial branch or first available
    return initialBranchId || '';
  });
  
  // Get next allowed date for branch managers
  const { nextAllowedDate, isDateRestricted } = useNextAllowedDate({
    userRole,
    branchId: selectedBranchId,
    isEditMode: false,
  });

  // Common date for all steps - initialized based on user role
  const [commonDate, setCommonDate] = useState<Date>(() => {
    // For branch managers, use next allowed date if available
    if (userRole?.toLowerCase() === 'branch' && nextAllowedDate) {
      const date = new Date(nextAllowedDate);
      date.setUTCHours(18, 30, 0, 0);
      return date;
    }
    // For admins, use yesterday
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    yesterday.setUTCHours(18, 30, 0, 0);
    return yesterday;
  });

  // Update commonDate when nextAllowedDate is available for branch managers
  useEffect(() => {
    if (isDateRestricted && nextAllowedDate) {
      const date = new Date(nextAllowedDate);
      date.setUTCHours(18, 30, 0, 0);
      setCommonDate(date);
    }
  }, [isDateRestricted, nextAllowedDate]);
  
  // Persistent data across all steps
  const [addedExpenses, setAddedExpenses] = useState<AddedExpense[]>([]);
  const [addedCredits, setAddedCredits] = useState<AddedCredit[]>([]);
  const [addedDeposits, setAddedDeposits] = useState<AddedDeposit[]>([]);
  const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([]);
  const [addedPayments, setAddedPayments] = useState<AddedPayment[]>([]);
  const [savedRecords, setSavedRecords] = useState<{ [key: string]: number }>({
    expenses: 0,
    credits: 0,
    deposits: 0,
    products: 0,
    payments: 0,
  });

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const isStepCompleted = useCallback((stepIndex: number) => {
    return completedSteps.has(stepIndex);
  }, [completedSteps]);

  const markStepCompleted = useCallback((stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]));
  }, []);

  const markCurrentStepCompleted = useCallback(() => {
    setIsCurrentStepCompleted(true);
    markStepCompleted(currentStep);
  }, [currentStep, markStepCompleted]);

  const goToNext = useCallback(async () => {
    if (onSaveAndNext) {
      const saveHandler = onSaveAndNext();
      if (typeof saveHandler === 'function') {
        const isValid = await saveHandler();
        if (!isValid) {
          return; // Don't proceed if validation fails
        }
      }
    }

    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setIsCurrentStepCompleted(isStepCompleted(nextStep));
      onStepChange?.(nextStep);
    } else {
      onComplete?.();
    }
  }, [currentStep, totalSteps, onComplete, onStepChange, onSaveAndNext, isStepCompleted]);

  const goToPrevious = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setIsCurrentStepCompleted(isStepCompleted(prevStep));
      onStepChange?.(prevStep);
    }
  }, [currentStep, onStepChange, isStepCompleted]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      setIsCurrentStepCompleted(isStepCompleted(step));
      onStepChange?.(step);
    }
  }, [totalSteps, onStepChange, isStepCompleted]);

  const canGoNext = currentStep < totalSteps - 1;
  const canGoPrevious = currentStep > 0;

  const value: WizardContextType = {
    currentStep,
    totalSteps,
    steps,
    goToNext,
    goToPrevious,
    goToStep,
    markStepCompleted,
    markCurrentStepCompleted,
    isStepCompleted,
    canGoNext,
    canGoPrevious,
    isLastStep,
    isFirstStep,
    onSaveAndNext,
    setOnSaveAndNext,
    isStepDisabled,
    setIsStepDisabled,
    isCurrentStepCompleted,
    setIsCurrentStepCompleted,
    // Common date
    commonDate,
    setCommonDate,
    // Branch selection
    selectedBranchId,
    setSelectedBranchId,
    userRole,
    userBranchId,
    // Pump closed
    isPumpClosed,
    setIsPumpClosed,
    // Persistent data
    addedExpenses,
    setAddedExpenses,
    addedCredits,
    setAddedCredits,
    addedDeposits,
    setAddedDeposits,
    addedProducts,
    setAddedProducts,
    addedPayments,
    setAddedPayments,
    savedRecords,
    setSavedRecords,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
};

// Common Date Picker Component
const CommonDatePicker: React.FC = () => {
  const { commonDate, setCommonDate, selectedBranchId, userRole } = useWizard();
  
  // Get next allowed date for branch managers
  const { isDateRestricted } = useNextAllowedDate({
    userRole,
    branchId: selectedBranchId,
    isEditMode: false,
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center h-9">Select Date:</span>
      {isDateRestricted ? (
        // Disabled date field for branch managers
        <Button
          variant="outline"
          disabled
          className={cn(
            "w-full sm:w-[240px] h-9 justify-start text-left font-normal bg-muted cursor-not-allowed",
            !commonDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {commonDate ? format(commonDate, "PPP") : <span>Pick a date</span>}
        </Button>
      ) : (
        // Editable date field for admins
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[240px] h-9 justify-start text-left font-normal",
                !commonDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {commonDate ? format(commonDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={commonDate}
              onSelect={(date) => {
                if (date) {
                  // Set to 18:30:00.000 UTC (6:30 PM UTC)
                  date.setUTCHours(18, 30, 0, 0);
                  setCommonDate(date);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

// Step Indicator Component
const StepIndicator: React.FC = () => {
  const { currentStep, totalSteps, steps, goToStep, isStepCompleted } = useWizard();

  return (
    <div className="overflow-x-auto mb-8 -mx-4 px-4">
      <div className="flex items-center justify-start min-w-max gap-1 sm:gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <button
                onClick={() => goToStep(index)}
                className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors",
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : isStepCompleted(index)
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isStepCompleted(index) ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  index + 1
                )}
              </button>
              <span className={cn(
                "text-[10px] sm:text-xs mt-1 sm:mt-2 text-center max-w-[60px] sm:max-w-20 truncate",
                index === currentStep ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </div>
            {index < totalSteps - 1 && (
              <div className={cn(
                "w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 flex-shrink-0",
                isStepCompleted(index) ? "bg-green-500" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Progress Bar Component
const ProgressBar: React.FC = () => {
  const { currentStep, totalSteps } = useWizard();
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-muted-foreground mb-2">
        <span>Step {currentStep + 1} of {totalSteps}</span>
        <span>{Math.round(progress)}% Complete</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};

// Navigation Component
interface WizardNavigationProps {
  onBack?: () => void;
  isLoading?: boolean;
  nextButtonText?: string;
  backButtonText?: string;
  onSave?: () => Promise<void>;
  saveButtonText?: string;
}

const WizardNavigation: React.FC<WizardNavigationProps> = ({
  onBack,
  isLoading = false,
  nextButtonText,
  backButtonText,
  onSave,
  saveButtonText = "Save",
}) => {
  const { 
    currentStep, 
    steps, 
    goToNext, 
    goToPrevious, 
    isLastStep, 
    isFirstStep,
    isStepDisabled,
    isCurrentStepCompleted
  } = useWizard();

  const [isSaving, setIsSaving] = useState(false);
  const currentStepData = steps[currentStep];

  const handleNext = async () => {
    await goToNext();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goToPrevious();
    }
  };

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave();
      } catch (error) {
        console.error('Error saving:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="flex justify-between items-center pt-6 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={handleBack}
        disabled={isFirstStep || isLoading || isSaving}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        {backButtonText || "Back"}
      </Button>

      <div className="flex items-center gap-2">
        {onSave && (
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={isLoading || isSaving || isStepDisabled || !isCurrentStepCompleted}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              saveButtonText
            )}
          </Button>
        )}
        <div className="text-sm text-muted-foreground">
          {currentStepData?.description}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleNext}
        disabled={isLoading || isSaving || isStepDisabled || !isCurrentStepCompleted}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Saving...
          </>
        ) : (
          <>
            {nextButtonText || (isLastStep ? "Finish" : "Save & Next")}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </>
        )}
      </Button>
    </div>
  );
};

// Main Wizard Component
interface FormWizardProps {
  steps: WizardStep[];
  onComplete?: () => void;
  onStepChange?: (step: number) => void;
  title?: string;
  description?: string;
  className?: string;
  initialBranchId?: string;
  userRole?: string;
  userBranchId?: string;
  onSave?: () => Promise<void>;
  saveButtonText?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onComplete,
  onStepChange,
  title = "Form Wizard",
  description = "Complete all steps to finish the process",
  className,
  initialBranchId,
  userRole,
  userBranchId,
  onSave,
  saveButtonText,
}) => {
  return (
    <WizardProvider 
      steps={steps} 
      onComplete={onComplete} 
      onStepChange={onStepChange}
      initialBranchId={initialBranchId}
      userRole={userRole}
      userBranchId={userBranchId}
    >
      <div className={cn("w-full mx-auto", className)}>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl break-words">{title}</CardTitle>
            <p className="text-muted-foreground break-words">{description}</p>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mt-4">
              <CommonDatePicker />
              <BranchSelector />
              <ClosedDayToggle />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <StepIndicator />
            <ProgressBar />
            <WizardContent />
            <WizardNavigation onSave={onSave} saveButtonText={saveButtonText} />
          </CardContent>
        </Card>
      </div>
    </WizardProvider>
  );
};

// Wizard Content Component
const WizardContent: React.FC = () => {
  const { currentStep, steps } = useWizard();
  const CurrentStepComponent = steps[currentStep]?.component;

  if (!CurrentStepComponent) {
    return <div>Step component not found</div>;
  }

  return (
    <div className="min-h-[600px]">
      <CurrentStepComponent />
    </div>
  );
};

// Branch Selector Component for Wizard
const BranchSelector: React.FC = () => {
  const { selectedBranchId, setSelectedBranchId, userRole, userBranchId } = useWizard();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = userRole?.toLowerCase() === 'admin';

  // Fetch branches on mount
  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branch');
        const data = await response.json();
        setBranches(data.data || []);
        
        // For non-admin users, ensure their branch is selected
        if (!isAdmin && userBranchId) {
          setSelectedBranchId(userBranchId);
        } else if (!selectedBranchId && data.data && data.data.length > 0 && isAdmin) {
          // For admin users, if no branch is selected, select the first one
          setSelectedBranchId(data.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Ensure non-admin users always have their branch selected (prevent changes)
  React.useEffect(() => {
    if (!isAdmin && userBranchId && selectedBranchId !== userBranchId) {
      console.log('Wizard: Enforcing user branch for non-admin:', userBranchId);
      setSelectedBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId, selectedBranchId, setSelectedBranchId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Loading branches...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto mb-4">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center h-9">Branch:</span>
      <select
        value={selectedBranchId}
        onChange={(e) => {
          // Only allow changes if user is admin
          if (isAdmin) {
            setSelectedBranchId(e.target.value);
          }
        }}
        disabled={!isAdmin}
        className={`w-full sm:w-auto h-9 px-3 border rounded-md text-sm bg-background min-w-0 max-w-full flex items-center ${!isAdmin ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
};

// ClosedDayToggle Component
const ClosedDayToggle: React.FC = () => {
  const { commonDate, selectedBranchId, isPumpClosed, setIsPumpClosed } = useWizard();
  const [loading, setLoading] = useState(false);
  // Import toast dynamically to avoid SSR issues
  const [toast, setToast] = useState<((msg: string) => void) | null>(null);

  React.useEffect(() => {
    import('sonner').then((mod) => {
      setToast(() => mod.toast.success);
    });
  }, []);

  // Check if this date is already closed when date or branch changes
  React.useEffect(() => {
    if (!selectedBranchId || !commonDate) return;
    const y = commonDate.getFullYear();
    const m = String(commonDate.getMonth() + 1).padStart(2, '0');
    const d = String(commonDate.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;
    fetch(`/api/closed-days?branchId=${selectedBranchId}&date=${formatted}`)
      .then((r) => r.json())
      .then((json) => {
        setIsPumpClosed((json.data?.length ?? 0) > 0);
      })
      .catch(() => setIsPumpClosed(false));
  }, [commonDate, selectedBranchId, setIsPumpClosed]);

  const handleToggle = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const y = commonDate.getFullYear();
      const mo = String(commonDate.getMonth() + 1).padStart(2, '0');
      const dy = String(commonDate.getDate()).padStart(2, '0');
      const formatted = `${y}-${mo}-${dy}`;
      if (isPumpClosed) {
        // Unmark
        await fetch(
          `/api/closed-days?date=${formatted}&branchId=${selectedBranchId}`,
          { method: 'DELETE' }
        );
        setIsPumpClosed(false);
        toast?.('Day unmarked — pump is open');
      } else {
        // Mark as closed
        await fetch('/api/closed-days', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: formatted, branchId: selectedBranchId, reason: 'Pump closed' }),
        });
        setIsPumpClosed(true);
        toast?.(`Marked as closed for ${formatted}`);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || !selectedBranchId}
      className={cn(
        'flex items-center gap-2 h-9 px-4 rounded-md border text-sm font-medium transition-colors',
        isPumpClosed
          ? 'bg-red-100 border-red-400 text-red-700 hover:bg-red-200'
          : 'bg-background border-input text-muted-foreground hover:bg-muted',
        (loading || !selectedBranchId) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <PowerOff className={cn('w-4 h-4', isPumpClosed ? 'text-red-600' : '')} />
      )}
      {isPumpClosed ? 'Closed' : 'Mark as Closed'}
    </button>
  );
};

// Export all components
export { WizardNavigation, StepIndicator, ProgressBar, CommonDatePicker, BranchSelector, ClosedDayToggle };
