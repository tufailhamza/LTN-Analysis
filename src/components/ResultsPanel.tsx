import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Variable {
  id: string;
  name: string;
  value: [number, number];
}

interface ResultsPanelProps {
  variables: Variable[];
  selectedTracts: any[];
  onTractRemove: (tractId: string) => void;
  onTractHighlight: (tractId: string) => void;
}

// Mock data for census tracts
const mockCensusTracts = [
  { id: '36061000100', name: 'Manhattan - Tract 1', crashes: 45, carfree: 65, vulnerable: 28, income: 85000, transit: 95 },
  { id: '36061000200', name: 'Brooklyn - Tract 2', crashes: 78, carfree: 42, vulnerable: 35, income: 62000, transit: 78 },
  { id: '36061000300', name: 'Queens - Tract 3', crashes: 52, carfree: 38, vulnerable: 31, income: 58000, transit: 65 },
  { id: '36061000400', name: 'Bronx - Tract 4', crashes: 91, carfree: 55, vulnerable: 42, income: 45000, transit: 72 },
  { id: '36061000500', name: 'Staten Island - Tract 5', crashes: 34, carfree: 25, vulnerable: 22, income: 72000, transit: 48 },
];

const ResultsPanel = ({ variables, selectedTracts, onTractRemove, onTractHighlight }: ResultsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg transition-all duration-300 z-[1000]',
        isExpanded ? 'h-[60vh]' : 'h-12'
      )}
    >
      {/* Header/Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-12 flex items-center justify-between px-6 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">
            Selected Tracts ({selectedTracts.length})
          </h3>
          {selectedTracts.length > 0 && (
            <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
              {selectedTracts.length} selected
            </span>
          )}
        </div>
        <ChevronUp
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-300',
            isExpanded ? 'rotate-180' : ''
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] overflow-auto px-8 pt-4 pb-0">
          {selectedTracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">No tracts selected</p>
              <p className="text-xs mt-1">Click on census tracts in the map to add them here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Census Tract</TableHead>
                  <TableHead className="font-semibold text-right">Car-Free Households (%)</TableHead>
                  <TableHead className="font-semibold text-right">Median Income ($)</TableHead>
                  <TableHead className="font-semibold text-right">Transit Access Score (%)</TableHead>
                  <TableHead className="font-semibold text-right">Vulnerable Residents (%)</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTracts.map((tract) => {
                  // Handle both feature format and direct data format
                  const tractData = tract.properties || tract;
                  const geoid = tractData.GEOID || tract.GEOID;
                  const name = tractData.NAME || tractData.name || `Tract ${tractData.tract || ''}`;
                  
                  return (
                    <TableRow 
                      key={geoid}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => onTractHighlight(geoid)}
                    >
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">
                        {tractData.carfree !== undefined ? `${parseFloat(String(tractData.carfree)).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {tractData.income ? `$${parseInt(String(tractData.income)).toLocaleString()}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {tractData.transit !== undefined ? `${parseFloat(String(tractData.transit)).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {tractData.vulnerable !== undefined ? `${parseFloat(String(tractData.vulnerable)).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTractRemove(geoid);
                          }}
                          className="text-destructive hover:text-destructive/80 text-xs px-2 py-1 rounded border border-destructive/20 hover:bg-destructive/10"
                        >
                          Remove
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsPanel;
