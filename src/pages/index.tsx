import { useState } from 'react';
import MapView from '@/components/MapView';
import SidebarSection from '@/components/SidebarSection';
import AnalysisVariable from '@/components/AnalysisVariable';
import ResultsPanel from '@/components/ResultsPanel';
import { Map, CheckCircle, Activity ,CalendarIcon} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calender';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCollisionData } from '@/hooks/useCollisionData';
import { useCensusData } from '@/hooks/useCensusData';

interface Variable {
  id: string;
  name: string;
  value: [number, number]; // Range [min, max]
  definition: string;
  min?: number;
  max?: number;
}

const Index = () => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [collisionType, setCollisionType] = useState<string>("all");
  const [overlayType, setOverlayType] = useState<string>("none");
  const [variables, setVariables] = useState<Variable[]>([
    {
      id: 'carfree',
      name: 'Percent Car-Free Households',
      value: [0, 100],
      definition: 'Car-free households are those that do not own any motor vehicles. Calculated from ACS table B25044.',
      max: 100,
    },
    {
      id: 'income',
      name: 'Median Household Income',
      value: [0, 500000],
      definition: 'The median income of all households in the census tract (ACS table B19013).',
      min: 0,
      max: 500000,
    },
    {
      id: 'transit',
      name: 'Transit Access Score',
      value: [0, 100],
      definition: 'Percent of people who use public transit to commute. Calculated from ACS table B08301 (Means of Transportation to Work).',
      max: 100,
    },
    {
      id: 'vulnerable',
      name: 'Percent Vulnerable Residents',
      value: [0, 100],
      definition: 'Combined metric: children (under 18), seniors (65+), and individuals with disabilities. Calculated from ACS tables B01001 (age) and B18101 (disability).',
      max: 100,
    },
    {
      id: 'greenspace',
      name: 'Percent Greenspace',
      value: [0, 100],
      definition: 'The percentage of land area in the census tract that is dedicated to parks, gardens, and other green spaces.',
      max: 100,
    },
  ]);

  const [selectedTracts, setSelectedTracts] = useState<any[]>([]);
  const [hoveredTract, setHoveredTract] = useState<any>(null);

  // Get geoJsonData for tract geometries
  const { geoJsonData } = useCensusData();

  // Fetch collision data based on date range and collision type
  const { collisions, loading: collisionsLoading, counts: collisionCounts } = useCollisionData({
    startDate: dateFrom,
    endDate: dateTo,
    collisionType: collisionType as 'all' | 'injuries' | 'fatalities',
    enabled: !!dateFrom && !!dateTo, // Only fetch when both dates are set
  });

  
  const handleVariableChange = (id: string, value: [number, number]) => {
    setVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, value } : v))
    );
  };

  const handleTractSelect = async (tract: any) => {
    // Handle both feature format and direct data format
    const tractData = tract.properties || tract;
    const geoid = tractData.GEOID || tract.GEOID;
    
    if (!geoid) return;
    
    // Check if tract is already selected
    const isAlreadySelected = selectedTracts.some(t => {
      const tGeoid = t.properties?.GEOID || t.GEOID;
      return tGeoid === geoid;
    });
    
    if (!isAlreadySelected) {
      // Ensure we're storing in a consistent format
      const fullTractData = {
        properties: tractData,
        ...tract
      };
      
      setSelectedTracts(prev => [...prev, fullTractData]);
    }
  };

  const handleTractRemove = (tractId: string) => {
    setSelectedTracts(prev => prev.filter(tract => {
      const tGeoid = tract.properties?.GEOID || tract.GEOID;
      return tGeoid !== tractId;
    }));
  };

  const handleTractHover = (tract: any) => {
    setHoveredTract(tract);
  };

  const handleTractHighlight = (tractId: string) => {
    // Trigger highlight on the map
    if (!tractId) {
      console.warn('handleTractHighlight called with invalid tractId');
      return;
    }
    
    if ((window as any).__highlightTract) {
      (window as any).__highlightTract(tractId);
    } else {
      console.warn('__highlightTract function not available on window');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Map className="h-6 w-6 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">NYC Low Traffic Neighborhood (LTN) Needs Assessment Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Authenticated</span>
            </Button>
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-96 border-r border-border bg-card relative z-10 flex flex-col h-full">
          <div className="p-6 border-b border-border flex-shrink-0">
            <p className="text-sm text-muted-foreground">
              Use the filters in the left panel to identify which New York City neighborhoods could benefit the most from low traffic solutions based on key community and mobility indicators.
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 pb-8 sidebar-scroll">

        <SidebarSection title="Analysis Variables" defaultOpen={true}>
          {variables.map((variable) => (
            <AnalysisVariable
              key={variable.id}
              name={variable.name}
              value={variable.value}
              onChange={(value) => handleVariableChange(variable.id, value)}
              definition={variable.definition}
              min={variable.min}
              max={variable.max}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Vehicle Collisions" defaultOpen={false}>
          <div className="space-y-4">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

          {/* Collision Type Radio Buttons */}
          <div className="space-y-3">
              <Label className="text-sm font-medium">Collision Type</Label>
              <RadioGroup value={collisionType} onValueChange={setCollisionType}>
                <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    Show all Collisions
                  </Label>
                </div>
                  {dateFrom && dateTo && collisionCounts && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {collisionCounts.all.toLocaleString()} collisions
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="injuries" id="injuries" />
                  <Label htmlFor="injuries" className="font-normal cursor-pointer">
                      Show Only Collisions with Injuries
                  </Label>
                  </div>
                  {dateFrom && dateTo && collisionCounts && (
                    <span className="text-xs text-orange-600 font-medium">
                      {collisionCounts.injuries.toLocaleString()} collisions
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fatalities" id="fatalities" />
                  <Label htmlFor="fatalities" className="font-normal cursor-pointer">
                      Show Only Collisions with Fatalities
                  </Label>
                  </div>
                  {dateFrom && dateTo && collisionCounts && (
                    <span className="text-xs text-red-600 font-medium">
                      {collisionCounts.fatalities.toLocaleString()} collisions
                    </span>
                  )}
                </div>
              </RadioGroup>
            </div>

            {/* Collision Count Display */}
            {dateFrom && dateTo && (
              <div className="pt-2 border-t border-border">
                {collisionsLoading ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Activity className="h-3 w-3 animate-pulse" />
                    Loading collisions...
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground mb-1">
                      {collisions.length.toLocaleString()} collision{collisions.length !== 1 ? 's' : ''} found
                    </div>
                    <div className="text-[10px]">
                      Showing as red dots on map
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SidebarSection>

        <SidebarSection title="Additional Overlays" defaultOpen={false}>
          <div className="space-y-3 pb-2">
            <RadioGroup value={overlayType} onValueChange={setOverlayType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="font-normal cursor-pointer">
                  None
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bikeLanes" id="bikeLanes" />
                <Label htmlFor="bikeLanes" className="font-normal cursor-pointer">
                  DOT Bike Lanes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parkSpace" id="parkSpace" />
                <Label htmlFor="parkSpace" className="font-normal cursor-pointer">
                  DPR Parks
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="greenstreets" id="greenstreets" />
                <Label htmlFor="greenstreets" className="font-normal cursor-pointer">
                  DPR Greenstreets
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mtaBusLanes" id="mtaBusLanes" />
                <Label htmlFor="mtaBusLanes" className="font-normal cursor-pointer">
                  MTA Bus Lanes
                </Label>
              </div>
            </RadioGroup>
          </div>
        </SidebarSection>

          </div>
      </aside>
      

        {/* Map View */}
        <main className="flex-1 relative pb-12">
          <MapView 
            variables={variables} 
            selectedTracts={selectedTracts}
            onTractSelect={handleTractSelect}
            onTractHover={handleTractHover}
            onTractHighlight={handleTractHighlight}
            collisions={collisions}
            collisionsLoading={collisionsLoading}
            overlayType={overlayType}
          />
        </main>
      </div>

      {/* Results Panel */}
      <ResultsPanel 
        variables={variables} 
        selectedTracts={selectedTracts}
        onTractRemove={handleTractRemove}
        onTractHighlight={handleTractHighlight}
        collisions={collisions}
        geoJsonData={geoJsonData}
      />
    </div>
  );
};

export default Index;
