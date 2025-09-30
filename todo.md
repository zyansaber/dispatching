# Firebase Data Dashboard MVP

## Files to Create:
1. **src/pages/Index.tsx** - Main dashboard page with tables
2. **src/lib/firebase.ts** - Firebase configuration and data fetching functions
3. **src/components/DataTables.tsx** - Table components for displaying data
4. **src/types/index.ts** - TypeScript interfaces for data structures

## Implementation Plan:
1. Set up Firebase configuration
2. Create data types/interfaces
3. Implement data fetching logic
4. Create table components for:
   - Dispatch data with reallocation column
   - Reallocation data (latest entries only, filtered by Regent Production status)
5. Connect all three datasets using chassis numbers as keys

## Key Logic:
- Filter reallocation data to show only latest entry per chassis
- Cross-reference with schedule data to exclude "Finished" Regent Production
- Add reallocatedTo column to Dispatch table when chassis numbers match
- Use chassis numbers to connect all three datasets