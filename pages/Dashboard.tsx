// Dashboard.tsx

import React, { useState } from 'react';
import DashboardNavbar from '../components/DashboardNavbar';
import { Box } from '@chakra-ui/react';
import LoadingLayout from '../components/LoadingLayout';
import DynamicQuizTable from '../components/DynamicQuizTable';
import CountdownTimer from '../components/CountdownTimer';
import MotivationalQuote from '../components/MotivationalQuote';
import CalendarEditor from '../components/CalendarEditor'; // Ensure this path is correct

const Dashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddNewQuizSet = () => {
    // Refresh the quiz sets by updating the refresh key
    setRefreshKey(oldKey => oldKey + 1);
  };

  return (
    <LoadingLayout>
      <Box>
        <DashboardNavbar onAddNewQuizSet={handleAddNewQuizSet} />
        <CalendarEditor />
        <DynamicQuizTable key={refreshKey} />
        <Box display="flex" justifyContent="center" mt="20px"> {/* Center horizontally */}
          <Box display="flex" alignItems="center" gap="4"> {/* Flex container for items */}
            <Box flex="1"> {/* Smaller flex-grow for CountdownTimer */}
              <CountdownTimer />
            </Box>
            <Box flex="100"> {/* Larger flex-grow for MotivationalQuote */}
              <MotivationalQuote />
            </Box>
          </Box>
        </Box>
      </Box>
    </LoadingLayout>
  );
};

export default Dashboard;