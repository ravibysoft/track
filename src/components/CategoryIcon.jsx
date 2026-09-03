import { getCategory } from "../lib/categories.js";
import Icon from "./Icon.jsx";

const SIZES = { sm: "cat cat--sm", md: "cat", lg: "cat cat--lg" };

export default function CategoryIcon({ id, size = "md" }) {
  const category = getCategory(id);
  return (
    <span className={SIZES[size] ?? SIZES.md} style={{ "--cat-color": category.color }}>
      <Icon name={category.id} />
    </span>
  );
}
