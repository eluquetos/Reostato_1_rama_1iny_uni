# Reostato_1_rama_1iny_uni

Calculadora para un nodo y dos ramas. Usa dos inyecciones independientes en las mediciones de campo, una sola alimentación durante la regulación y genera un diagrama unifilar actualizado con los resultados.

Aplicación web instalable para calcular y regular dos ramas resistivas conectadas a un solo nodo.

## Mediciones de campo

- La inyección A alimenta únicamente la rama 11 y calcula `R11` con `VA`, `RcA` e `I11`.
- La inyección B alimenta únicamente la rama 12 y calcula `R12` con `VB`, `RcB` e `I12`.
- Durante estas mediciones, los reóstatos se consideran en `0 Ω`.

## Regulación

Una sola fuente alimenta ambas ramas en paralelo mediante `Rc1`. La aplicación permite editar `R11`, `R12`, el voltaje, `Rc1`, las corrientes objetivo y los reóstatos. También calcula la potencia de cada reóstato y verifica KCL, KVL y el balance de potencia.

La aplicación funciona en PC, iPhone y Android desde un navegador moderno y puede instalarse como PWA.
