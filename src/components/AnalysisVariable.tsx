import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface AnalysisVariableProps {
  name: string;
  value: [number, number]; // Range with [min, max]
  onChange: (value: [number, number]) => void;
  definition: string;
  min?: number;
  max?: number;
}

const AnalysisVariable = ({
  name,
  value,
  onChange,
  definition,
  min = 0,
  max = 100,
}: AnalysisVariableProps) => {
  return (
    <div className="space-y-3 p-5 rounded-lg border border-border bg-card hover:border-accent/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-card-foreground">{name}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-accent transition-colors">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{definition}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-sm font-mono text-muted-foreground">
          {value[0]} - {value[1]}
        </span>
      </div>
      
      <Slider
        value={value}
        onValueChange={(values) => onChange(values as [number, number])}
        max={max}
        min={min}
        step={1}
        className="w-full"
        minStepsBetweenThumbs={1}
      />
    </div>
  );
};

export default AnalysisVariable;
