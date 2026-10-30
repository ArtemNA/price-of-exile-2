// The theme registry (src/app/themes.ts) imports the addon themes' components; Angular's packages
// are partially compiled, so tests that load them need the JIT compiler (nothing is rendered).
import '@angular/compiler';
