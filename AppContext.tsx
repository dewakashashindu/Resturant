import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext({
  ipAddress: '192.168.1.153', 
  setIpAddress: (ip: string) => {},
});

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [ipAddress, setIpAddress] = useState('192.168.1.153');
  return (
    <AppContext.Provider value={{ ipAddress, setIpAddress }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);