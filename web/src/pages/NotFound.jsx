import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';
export default function NotFound() { return <div className="wrap section"><Empty title="Page not found"><Link to="/">Go to home</Link></Empty></div>; }
