import { useState } from 'react';
import MapView from '@/components/MapView';
import SidebarSection from '@/components/SidebarSection';
import AnalysisVariable from '@/components/AnalysisVariable';
import ResultsPanel from '@/components/ResultsPanel';
import { Map, CheckCircle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Variable {
  id: string;
  name: string;
  value: [number, number]; // Range [min, max]
  definition: string;
  min?: number;
  max?: number;
}

const Index = () => {
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
      value: [0, 200000],
      definition: 'The median income of all households in the census tract (ACS table B19013).',
      min: 0,
      max: 200000,
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
  ]);

  const [selectedTracts, setSelectedTracts] = useState<any[]>([]);
  const [hoveredTract, setHoveredTract] = useState<any>(null);

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
    // This could be used to highlight the tract on the map
    console.log('Highlighting tract:', tractId);
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
        <aside className="w-96 border-r border-border bg-card overflow-y-auto">
          <div className="p-6 border-b border-border">
            <p className="text-sm text-muted-foreground">
              Use the filters in the left panel to identify which New York City neighborhoods could benefit the most from low traffic solutions based on key community and mobility indicators.
            </p>
          </div>

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
      </aside>

        {/* Map View */}
        <main className="flex-1 relative pb-12">
          <MapView 
            variables={variables} 
            selectedTracts={selectedTracts}
            onTractSelect={handleTractSelect}
            onTractHover={handleTractHover}
          />
        </main>
      </div>

      {/* Results Panel */}
      <ResultsPanel 
        variables={variables} 
        selectedTracts={selectedTracts}
        onTractRemove={handleTractRemove}
        onTractHighlight={handleTractHighlight}
      />
    </div>
  );
};

export default Index;
