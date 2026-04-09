
import ProductGrid from '../components/pos/ProductGrid';
import Cart from '../components/pos/Cart';

export default function Sales() {
  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      <div className="flex-1 overflow-hidden">
        <ProductGrid />
      </div>
      <Cart />
    </div>
  );
}
