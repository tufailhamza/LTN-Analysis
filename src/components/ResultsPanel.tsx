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

type SortColumn = 'name' | 'carfree' | 'income' | 'transit' | 'vulnerable' | null;
type SortDirection = 'asc' | 'desc' | null;

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
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null (no sort)
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort the tracts based on current sort column and direction
  const sortedTracts = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return selectedTracts;
    }

    return [...selectedTracts].sort((a, b) => {
      const aData = a.properties || a;
      const bData = b.properties || b;

      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      switch (sortColumn) {
        case 'name':
          aValue = aData.NAME || aData.name || `Tract ${aData.tract || ''}`;
          bValue = bData.NAME || bData.name || `Tract ${bData.tract || ''}`;
          // String comparison
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' 
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }
          return 0;
        
        case 'carfree':
          aValue = aData.carfree !== undefined ? parseFloat(String(aData.carfree)) : undefined;
          bValue = bData.carfree !== undefined ? parseFloat(String(bData.carfree)) : undefined;
          break;
        
        case 'income':
          aValue = aData.income ? parseInt(String(aData.income)) : undefined;
          bValue = bData.income ? parseInt(String(bData.income)) : undefined;
          break;
        
        case 'transit':
          aValue = aData.transit !== undefined ? parseFloat(String(aData.transit)) : undefined;
          bValue = bData.transit !== undefined ? parseFloat(String(bData.transit)) : undefined;
          break;
        
        case 'vulnerable':
          aValue = aData.vulnerable !== undefined ? parseFloat(String(aData.vulnerable)) : undefined;
          bValue = bData.vulnerable !== undefined ? parseFloat(String(bData.vulnerable)) : undefined;
          break;
        
        default:
          return 0;
      }

      // Handle undefined/null values - put them at the end
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [selectedTracts, sortColumn, sortDirection]);

  // Render sort icon based on sort state
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 text-foreground" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 text-foreground" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
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
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent -ml-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('name');
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Census Tract
                        {renderSortIcon('name')}
                      </div>
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent -mr-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('carfree');
                      }}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Car-Free Households (%)
                        {renderSortIcon('carfree')}
                      </div>
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent -mr-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('income');
                      }}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Median Income ($)
                        {renderSortIcon('income')}
                      </div>
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent -mr-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('transit');
                      }}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Transit Access Score (%)
                        {renderSortIcon('transit')}
                      </div>
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent -mr-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('vulnerable');
                      }}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Vulnerable Residents (%)
                        {renderSortIcon('vulnerable')}
                      </div>
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
                          className="text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
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
