import {createRoot} from 'react-dom/client';
import App from './page.tsx';
import './global.css';

createRoot(document.getElementById('root')!).render(<App />);
