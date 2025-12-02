import { Hero } from '@/components/Hero';
import { DomainSearch } from '@/components/DomainSearch';

export function HomePage() {
  return (
    <div className="home-page">
      <Hero />
      <section className="search-section">
        <div className="container">
          <DomainSearch />
        </div>
      </section>

      <style>{`
        .search-section {
          padding: 0 0 6rem;
        }
      `}</style>
    </div>
  );
}
