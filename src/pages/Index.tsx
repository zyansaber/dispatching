import { useState, useEffect } from "react";
import { DispatchTable, ReallocationTable, DispatchStats } from "@/components/DataTables";
import { ProcessedDispatchEntry, ProcessedReallocationEntry } from "@/types";
import { 
  fetchReallocationData, 
  fetchDispatchData, 
  fetchScheduleData,
  processReallocationData,
  processDispatchData,
  getDispatchStats,
  filterDispatchData
} from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

export default function Index() {
  const [allDispatchData, setAllDispatchData] = useState<ProcessedDispatchEntry[]>([]);
  const [filteredDispatchData, setFilteredDispatchData] = useState<ProcessedDispatchEntry[]>([]);
  const [reallocationData, setReallocationData] = useState<ProcessedReallocationEntry[]>([]);
  const [rawReallocationData, setRawReallocationData] = useState({});
  const [dispatchStats, setDispatchStats] = useState({ 
    total: 0, 
    okStatus: 0, 
    invalidStock: 0, 
    snowyStock: 0, 
    canBeDispatched: 0 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data from Firebase
      const [rawReallocation, rawDispatch, rawSchedule] = await Promise.all([
        fetchReallocationData(),
        fetchDispatchData(),
        fetchScheduleData()
      ]);

      // Process the data according to requirements
      const processedReallocation = processReallocationData(rawReallocation, rawSchedule);
      const processedDispatch = processDispatchData(rawDispatch, rawReallocation);
      const stats = getDispatchStats(rawDispatch, rawReallocation);

      setReallocationData(processedReallocation);
      setAllDispatchData(processedDispatch);
      setRawReallocationData(rawReallocation);
      setDispatchStats(stats);
      
      // Set initial filtered data
      const initialFiltered = filterDispatchData(processedDispatch, activeFilter, rawReallocation);
      setFilteredDispatchData(initialFiltered);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data from Firebase. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    const filtered = filterDispatchData(allDispatchData, filter, rawReallocationData);
    setFilteredDispatchData(filtered);
    setGlobalSearchTerm(''); // Clear search when changing filter
  };

  const handleGlobalSearchChange = (term: string) => {
    setGlobalSearchTerm(term);
  };

  const handleRefresh = () => {
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading data from Firebase...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const safeStringIncludes = (value: any, searchTerm: string): boolean => {
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchTerm);
  };

  // Calculate search result counts with safe string handling
  const getSearchResultCounts = () => {
    if (!globalSearchTerm) {
      return {
        dispatchCount: filteredDispatchData.length,
        reallocationCount: reallocationData.length
      };
    }

    const searchLower = globalSearchTerm.toLowerCase();
    
    const dispatchMatches = allDispatchData.filter(entry => {
      const dispatchMatch = (
        safeStringIncludes(entry["Chassis No"], searchLower) ||
        safeStringIncludes(entry.Customer, searchLower) ||
        safeStringIncludes(entry.Model, searchLower) ||
        safeStringIncludes(entry["Matched PO No"], searchLower) ||
        safeStringIncludes(entry["SAP Data"], searchLower) ||
        safeStringIncludes(entry["Scheduled Dealer"], searchLower) ||
        safeStringIncludes(entry.Statuscheck, searchLower) ||
        safeStringIncludes(entry.DealerCheck, searchLower) ||
        safeStringIncludes(entry.reallocatedTo, searchLower)
      );
      
      const reallocationMatch = reallocationData.some(reallocationEntry => 
        reallocationEntry.chassisNumber === entry["Chassis No"] && (
          safeStringIncludes(reallocationEntry.chassisNumber, searchLower) ||
          safeStringIncludes(reallocationEntry.customer, searchLower) ||
          safeStringIncludes(reallocationEntry.model, searchLower) ||
          safeStringIncludes(reallocationEntry.originalDealer, searchLower) ||
          safeStringIncludes(reallocationEntry.reallocatedTo, searchLower) ||
          safeStringIncludes(reallocationEntry.regentProduction, searchLower) ||
          safeStringIncludes(reallocationEntry.issue?.type, searchLower)
        )
      );
      
      return dispatchMatch || reallocationMatch;
    });

    const reallocationMatches = reallocationData.filter(entry => {
      const reallocationMatch = (
        safeStringIncludes(entry.chassisNumber, searchLower) ||
        safeStringIncludes(entry.customer, searchLower) ||
        safeStringIncludes(entry.model, searchLower) ||
        safeStringIncludes(entry.originalDealer, searchLower) ||
        safeStringIncludes(entry.reallocatedTo, searchLower) ||
        safeStringIncludes(entry.regentProduction, searchLower) ||
        safeStringIncludes(entry.issue?.type, searchLower)
      );
      
      const dispatchMatch = allDispatchData.some(dispatchEntry => 
        dispatchEntry["Chassis No"] === entry.chassisNumber && (
          safeStringIncludes(dispatchEntry["Chassis No"], searchLower) ||
          safeStringIncludes(dispatchEntry.Customer, searchLower) ||
          safeStringIncludes(dispatchEntry.Model, searchLower) ||
          safeStringIncludes(dispatchEntry["Matched PO No"], searchLower) ||
          safeStringIncludes(dispatchEntry["SAP Data"], searchLower) ||
          safeStringIncludes(dispatchEntry["Scheduled Dealer"], searchLower) ||
          safeStringIncludes(dispatchEntry.Statuscheck, searchLower) ||
          safeStringIncludes(dispatchEntry.DealerCheck, searchLower) ||
          safeStringIncludes(dispatchEntry.reallocatedTo, searchLower)
        )
      );
      
      return reallocationMatch || dispatchMatch;
    });

    return {
      dispatchCount: dispatchMatches.length,
      reallocationCount: reallocationMatches.length
    };
  };

  const { dispatchCount, reallocationCount } = getSearchResultCounts();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Dispatch Dashboard
            </h1>
          </div>

          {/* Global Search */}
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <Input
                placeholder="Search across all data..."
                value={globalSearchTerm}
                onChange={(e) => handleGlobalSearchChange(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Reallocation Data - First Section (Collapsible) */}
          <ReallocationTable 
            data={reallocationData} 
            searchTerm={globalSearchTerm}
            onSearchChange={handleGlobalSearchChange}
            dispatchData={allDispatchData}
          />

          {/* Dispatch Data Section */}
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dispatch Data</h2>
            
            {/* Statistics Cards */}
            <DispatchStats 
              total={dispatchStats.total}
              invalidStock={dispatchStats.invalidStock}
              snowyStock={dispatchStats.snowyStock}
              canBeDispatched={dispatchStats.canBeDispatched}
              onFilterChange={handleFilterChange}
              activeFilter={activeFilter}
              onRefresh={handleRefresh}
            />

            {/* Dispatch Table */}
            <DispatchTable 
              data={filteredDispatchData}
              searchTerm={globalSearchTerm}
              onSearchChange={handleGlobalSearchChange}
              filter={activeFilter}
              allData={allDispatchData}
              reallocationData={reallocationData}
            />
          </div>

          {/* Summary */}
          <div className="text-center text-sm text-gray-500 bg-white p-4 rounded-lg">
            <p>
              Showing: Reallocation entries: {reallocationCount} | 
              Dispatch entries: {dispatchCount} | 
              Total dispatch entries: {dispatchStats.total}
              {globalSearchTerm && (
                <span className="text-blue-600 ml-2">
                  (Filtered by: "{globalSearchTerm}")
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}