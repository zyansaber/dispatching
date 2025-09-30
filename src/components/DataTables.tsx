import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, ArrowUpDown, AlertTriangle, RefreshCw } from "lucide-react";
import { ProcessedDispatchEntry, ProcessedReallocationEntry } from "@/types";
import { getGRDaysColor, getGRDaysWidth, reportError } from "@/lib/firebase";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface DispatchStatsProps {
  total: number;
  invalidStock: number;
  snowyStock: number;
  canBeDispatched: number;
  onFilterChange: (filter: string) => void;
  activeFilter: string;
  onRefresh: () => void;
}

export const DispatchStats = ({ 
  total, 
  invalidStock, 
  snowyStock, 
  canBeDispatched,
  onFilterChange, 
  activeFilter,
  onRefresh
}: DispatchStatsProps) => {
  const cards = [
    { label: "Total Number", value: total, filter: "all", color: "text-blue-600" },
    { label: "Invalid Stock", value: invalidStock, filter: "invalid", color: "text-red-600" },
    { label: "Snowy Stock", value: snowyStock, filter: "snowy", color: "text-purple-600" },
    { label: "Can be Dispatched", value: canBeDispatched, filter: "canBeDispatched", color: "text-emerald-600" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={onRefresh}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card 
            key={card.filter}
            className={`cursor-pointer transition-all hover:shadow-md ${
              activeFilter === card.filter ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onFilterChange(card.filter)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600 truncate">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface DispatchTableProps {
  data: ProcessedDispatchEntry[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filter: string;
  allData: ProcessedDispatchEntry[];
  reallocationData: ProcessedReallocationEntry[];
}

export const DispatchTable = ({ 
  data, 
  searchTerm, 
  onSearchChange, 
  filter,
  allData,
  reallocationData
}: DispatchTableProps) => {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleReportError = async (chassisNo: string) => {
    const entry = allData.find(e => e["Chassis No"] === chassisNo);
    if (!entry) return;

    const errorDetails = `Dealer Check Mismatch - SAP Data: ${entry["SAP Data"] || "N/A"}, Scheduled Dealer: ${entry["Scheduled Dealer"] || "N/A"}, Reallocation To: ${entry.reallocatedTo || "N/A"}`;
    
    const success = await reportError(chassisNo, errorDetails);
    
    if (success) {
      toast.success(`Error reported for chassis ${chassisNo}`);
    } else {
      toast.error("Failed to report error. Please try again.");
    }
  };

  const safeStringIncludes = (value: any, searchTerm: string): boolean => {
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchTerm);
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = searchTerm 
      ? allData.filter(entry => {
          const searchLower = searchTerm.toLowerCase();
          // Search in dispatch data with safe string handling
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
          
          // Also search in reallocation data for the same chassis
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
        })
      : data;

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key as keyof ProcessedDispatchEntry];
        const bValue = b[sortConfig.key as keyof ProcessedDispatchEntry];
        
        if (sortConfig.key === "GR to GI Days") {
          return sortConfig.direction === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        const aStr = String(aValue || '').toLowerCase();
        const bStr = String(bValue || '').toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [data, allData, searchTerm, sortConfig, reallocationData]);

  const maxGRDays = Math.max(...allData.map(entry => entry["GR to GI Days"]), 1);

  const SortableHeader = ({ children, sortKey, className = "" }: { children: React.ReactNode; sortKey: string; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-gray-50 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span className="truncate">{children}</span>
        <ArrowUpDown className="h-3 w-3 flex-shrink-0" />
      </div>
    </TableHead>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <CardTitle className="text-lg">
            Dispatch Data {filter !== 'all' && `(${filter === 'canBeDispatched' ? 'Can be Dispatched' : filter.charAt(0).toUpperCase() + filter.slice(1)})`}
          </CardTitle>
          <Input
            placeholder="Search all fields..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader sortKey="Chassis No" className="min-w-[120px]">Chassis No</SortableHeader>
                <SortableHeader sortKey="GR to GI Days" className="min-w-[100px]">GR Days</SortableHeader>
                <SortableHeader sortKey="Customer" className="min-w-[100px]">Customer</SortableHeader>
                <SortableHeader sortKey="Model" className="min-w-[80px]">Model</SortableHeader>
                <SortableHeader sortKey="SAP Data" className="min-w-[100px]">SAP Data</SortableHeader>
                <SortableHeader sortKey="Scheduled Dealer" className="min-w-[120px]">Scheduled Dealer</SortableHeader>
                <SortableHeader sortKey="Statuscheck" className="min-w-[80px]">Status</SortableHeader>
                <SortableHeader sortKey="DealerCheck" className="min-w-[80px]">Dealer</SortableHeader>
                <SortableHeader sortKey="reallocatedTo" className="min-w-[100px]">Reallocation</SortableHeader>
                <TableHead className="min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((entry, index) => {
                const barColor = getGRDaysColor(entry["GR to GI Days"]);
                const barWidth = getGRDaysWidth(entry["GR to GI Days"], maxGRDays);
                
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-sm">{entry["Chassis No"]}</TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{entry["GR to GI Days"]}</span>
                          <span className="text-gray-500">days</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${barColor}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[100px]" title={entry.Customer}>{entry.Customer}</TableCell>
                    <TableCell className="text-sm truncate max-w-[80px]" title={entry.Model || "-"}>{entry.Model || "-"}</TableCell>
                    <TableCell className="text-sm truncate max-w-[100px]" title={entry["SAP Data"] || "-"}>{entry["SAP Data"] || "-"}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]" title={entry["Scheduled Dealer"] || "-"}>{entry["Scheduled Dealer"] || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        entry.Statuscheck === 'OK' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.Statuscheck}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        entry.DealerCheck === 'OK' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.DealerCheck}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-blue-600 text-sm truncate max-w-[100px]" title={entry.reallocatedTo || "-"}>
                      {entry.reallocatedTo || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReportError(entry["Chassis No"])}
                        className="flex items-center space-x-1 text-xs"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span className="hidden sm:inline">Report</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

interface ReallocationTableProps {
  data: ProcessedReallocationEntry[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  dispatchData: ProcessedDispatchEntry[];
}

export const ReallocationTable = ({ data, searchTerm, onSearchChange, dispatchData }: ReallocationTableProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const safeStringIncludes = (value: any, searchTerm: string): boolean => {
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchTerm);
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = searchTerm 
      ? data.filter(entry => {
          const searchLower = searchTerm.toLowerCase();
          // Search in reallocation data with safe string handling
          const reallocationMatch = (
            safeStringIncludes(entry.chassisNumber, searchLower) ||
            safeStringIncludes(entry.customer, searchLower) ||
            safeStringIncludes(entry.model, searchLower) ||
            safeStringIncludes(entry.originalDealer, searchLower) ||
            safeStringIncludes(entry.reallocatedTo, searchLower) ||
            safeStringIncludes(entry.regentProduction, searchLower) ||
            safeStringIncludes(entry.issue?.type, searchLower)
          );
          
          // Also search in dispatch data for the same chassis
          const dispatchMatch = dispatchData.some(dispatchEntry => 
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
        })
      : data;

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key as keyof ProcessedReallocationEntry];
        const bValue = b[sortConfig.key as keyof ProcessedReallocationEntry];
        
        const aStr = String(aValue || '').toLowerCase();
        const bStr = String(bValue || '').toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig, dispatchData]);

  const SortableHeader = ({ children, sortKey, className = "" }: { children: React.ReactNode; sortKey: string; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-gray-50 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span className="truncate">{children}</span>
        <ArrowUpDown className="h-3 w-3 flex-shrink-0" />
      </div>
    </TableHead>
  );

  return (
    <Card className="w-full mb-8">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <CardTitle className="text-lg">Reallocation Data (Latest Entries, Excluding Finished)</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search reallocation data..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Button
              variant="outline"
              onClick={() => setIsVisible(!isVisible)}
              className="flex items-center justify-center space-x-2"
            >
              <span>{isVisible ? 'Hide' : 'Show'}</span>
              {isVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isVisible && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader sortKey="chassisNumber" className="min-w-[120px]">Chassis Number</SortableHeader>
                  <SortableHeader sortKey="customer" className="min-w-[100px]">Customer</SortableHeader>
                  <SortableHeader sortKey="model" className="min-w-[80px]">Model</SortableHeader>
                  <SortableHeader sortKey="originalDealer" className="min-w-[120px]">Original Dealer</SortableHeader>
                  <SortableHeader sortKey="reallocatedTo" className="min-w-[120px]">Reallocated To</SortableHeader>
                  <SortableHeader sortKey="regentProduction" className="min-w-[100px]">Regent Production</SortableHeader>
                  <SortableHeader sortKey="submitTime" className="min-w-[150px]">Submit Time</SortableHeader>
                  <TableHead className="min-w-[100px]">Issue Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-sm">{entry.chassisNumber}</TableCell>
                    <TableCell className="text-sm truncate max-w-[100px]" title={entry.customer}>{entry.customer}</TableCell>
                    <TableCell className="text-sm truncate max-w-[80px]" title={entry.model}>{entry.model}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]" title={entry.originalDealer}>{entry.originalDealer}</TableCell>
                    <TableCell className="font-medium text-green-600 text-sm truncate max-w-[120px]" title={entry.reallocatedTo}>{entry.reallocatedTo}</TableCell>
                    <TableCell className="text-sm truncate max-w-[100px]" title={entry.regentProduction}>{entry.regentProduction}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]" title={entry.submitTime}>{entry.submitTime}</TableCell>
                    <TableCell className="text-sm truncate max-w-[100px]" title={entry.issue?.type || "-"}>{entry.issue?.type || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};