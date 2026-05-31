import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Book from './pages/Book';
import GuidesIndex from './pages/GuidesIndex';
import GuideArticle from './pages/GuideArticle';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/guides" element={<GuidesIndex />} />
        <Route path="/guides/:slug" element={<GuideArticle />} />
      </Routes>
    </BrowserRouter>
  );
}
