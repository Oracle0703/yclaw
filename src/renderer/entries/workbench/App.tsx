import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}
