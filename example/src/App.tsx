import React from 'react';
import { Button } from './Button';
import { Card } from './Card';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Design AI Linter Example</h1>
        <p>This is an example React app demonstrating the design-ai-linter.</p>
      </header>
      
      <main className="app-main">
        <Card title="Primary Button">
          <Button variant="primary" onClick={() => alert('Primary clicked!')}>
            Primary Button
          </Button>
        </Card>
        
        <Card title="Secondary Button">
          <Button variant="secondary" onClick={() => alert('Secondary clicked!')}>
            Secondary Button
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default App;

