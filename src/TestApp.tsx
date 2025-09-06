import React from 'react';

function TestApp() {
  return (
    <div style={{ 
      padding: '50px', 
      fontSize: '24px', 
      textAlign: 'center',
      background: 'yellow',
      minHeight: '100vh'
    }}>
      <h1>Test App is Working!</h1>
      <p>If you can see this, React is rendering.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}

export default TestApp;