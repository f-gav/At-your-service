# PDF font subsets

DIN Pro Regular and Bold outlines are taken from the embedded CFF subsets in
`public/pathfinder/Pathfinder_2e_RU_editable_V1.pdf`, page one. OpenType wrappers
add Unicode character maps using the original Adobe glyph names; outlines are
unchanged. These are subsets, not full font distributions. Missing characters
use the existing sans-serif fallback at the requested weight. Do not use the
bold subset as the regular face fallback: capitals missing from Regular would
otherwise appear bold inside ordinary body text.
Myriad Pro in this PDF contains only the fi ligature and copyright glyph, so it
is not a usable body typeface. Ebbe headings are preserved separately.
