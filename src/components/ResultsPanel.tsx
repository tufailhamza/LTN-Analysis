import { useState, useMemo } from 'react';
import { ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

type SortColumn = 'name' | 'carfree' | 'income' | 'transit' | 'vulnerable';
type SortDirection = 'asc' | 'desc' | null;

const ResultsPanel = ({ variables, selectedTracts, onTractRemove, onTractHighlight }: ResultsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedTracts = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return selectedTracts;
    }

    return [...selectedTracts].sort((a, b) => {
      const aData = a.properties || a;
      const bData = b.properties || b;

      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case 'name':
          aValue = aData.NAME || aData.name || `Tract ${aData.tract || ''}`;
          bValue = bData.NAME || bData.name || `Tract ${bData.tract || ''}`;
          break;
        case 'carfree':
          aValue = aData.carfree !== undefined ? Number(aData.carfree) : -Infinity;
          bValue = bData.carfree !== undefined ? Number(bData.carfree) : -Infinity;
          break;
        case 'income':
          aValue = aData.income ? Number(aData.income) : -Infinity;
          bValue = bData.income ? Number(bData.income) : -Infinity;
          break;
        case 'transit':
          aValue = aData.transit !== undefined ? Number(aData.transit) : -Infinity;
          bValue = bData.transit !== undefined ? Number(bData.transit) : -Infinity;
          break;
        case 'vulnerable':
          aValue = aData.vulnerable !== undefined ? Number(aData.vulnerable) : -Infinity;
          bValue = bData.vulnerable !== undefined ? Number(bData.vulnerable) : -Infinity;
          break;
        default:
          return 0;
      }

      // Handle string comparison for name
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle numeric comparison
      const comparison = (aValue as number) - (bValue as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [selectedTracts, sortColumn, sortDirection]);

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  };

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
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('name')}
                      className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                    >
                      Census Tract
                      {getSortIcon('name')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('carfree')}
                      className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1 ml-auto"
                    >
                      Car-Free Households (%)
                      {getSortIcon('carfree')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('income')}
                      className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1 ml-auto"
                    >
                      Median Income ($)
                      {getSortIcon('income')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('transit')}
                      className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1 ml-auto"
                    >
                      Transit Access Score (%)
                      {getSortIcon('transit')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('vulnerable')}
                      className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1 ml-auto"
                    >
                      Vulnerable Residents (%)
                      {getSortIcon('vulnerable')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTracts.map((tract) => {
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
                      <TableCell className="font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTractHighlight(geoid);
                          }}
                          className="text-primary hover:text-primary/80 hover:underline font-medium"
                        >
                          {name}
                        </button>
                      </TableCell>
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
