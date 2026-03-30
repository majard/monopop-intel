# tests/test_product_normalizer.py
import pytest
from parsers.product_normalizer import clean_and_classify

"""
Regression + knowledge-base tests for clean_and_classify.

76/80 tests passing.
The 4 failing ones are known gaps we accept for v1:
- Biscoito Recheio Cheesecake... (returns biscoito recheado)
- Papel Alumínio... (package_size still None)
- Areia Sanitária Pipicat... (returns None)
- Chiclete Trident Melancia... (returns None)

This file stores everything we learned during dry-run tuning.
"""


@pytest.mark.parametrize(
    "name, term, expected_generic, expected_noise, expected_size, expected_unit, note",
    [
        # ==================== OVO FAMILY (our #1 pain point) ====================
        (
            "Ovos Tipo Grande Vermelhos Mantiqueira Happy Eggs 10 Unidades",
            "ovo",
            "ovo",
            False,
            10.0,
            "un",
            "plural should match",
        ),
        ("Ovo Cozido Quasi Pronto Unidade", "ovo", "ovo", False, None, None, ""),
        (
            "Kinder Ovo Laranja 1 Unidade 20g",
            "ovo",
            "ovo",
            False,
            20.0,
            "g",
            "chocolate egg should still be ovo",
        ),
        (
            "Ovos Vermelhos Jumbo Happy Eggs com 10 Unidades",
            "ovo",
            "ovo",
            False,
            10.0,
            "un",
            "",
        ),
        (
            "OVOS VERMELHO CAIPIRA C 6 UN",
            "ovo",
            "ovo",
            False,
            6.0,
            "un",
            "uppercase + abbreviation",
        ),
        (
            "Massa de Sêmola com Ovos Fidelinho Piraquê 500g",
            "ovo",
            "massa",
            False,
            500.0,
            "g",
            "ingredient use = noise",
        ),
        (
            "Ninho com Ovos Renata 500g",
            "ovo",
            None,
            True,
            500.0,
            "g",
            "ingredient use = noise",
        ),
        (
            "Barra Proteica Ovomaltine 45g",
            "ovo",
            None,
            True,
            45.0,
            "g",
            "brand-like should not match",
        ),
        ("Ovos de Codorna Granja Loureiro 200G", "ovo", "ovo", False, 200.0, "g", ""),
        # ==================== MULTI-WORD GENERICS (used to shorten) ====================
        (
            "Feijão Fradinho Combrasil Tipo1 500g",
            "feijao fradinho",
            "feijao fradinho",
            False,
            500.0,
            "g",
            "",
        ),
        (
            "Feijão Fradinho Alemão 1Kg",
            "feijao fradinho",
            "feijao fradinho",
            False,
            1000.0,
            "g",
            "",
        ),
        (
            "Areia Higiênica p/ Gato Pipicat Classic 4Kg",
            "areia de gato",
            "areia de gato",
            False,
            4000.0,
            "g",
            "insertion",
        ),
        (
            "Ração para Gatos Adultos Friskies Frango 85g",
            "racao de gato",
            "racao de gato",
            False,
            85.0,
            "g",
            "",
        ),
        (
            "Molho de Tomate Tradicional Heinz 240g",
            "molho de tomate",
            "molho de tomate",
            False,
            240.0,
            "g",
            "",
        ),
        (
            "Linguica Toscana Seara 500g",
            "linguica toscana",
            "linguica toscana",
            False,
            500.0,
            "g",
            "",
        ),
        (
            "Leite Condensado Moça 395g",
            "leite condensado",
            "leite condensado",
            False,
            395.0,
            "g",
            "",
        ),
        (
            "Coxa Sobrecoxa de Frango Resfriado 1kg",
            "coxa sobrecoxa",
            "sobrecoxa",
            False,
            1000.0,
            "g",
            "",
        ),
        # ==================== FLAVOR / INGREDIENT BLEED ====================
        (
            "Mini Chip de Arroz Integral Cebola e Salsa 35g",
            "arroz",
            None,
            True,
            35.0,
            "g",
            "classic bleed",
        ),
        (
            "Iogurte Itambé Cenoura, Laranja E Mel 170g",
            "iogurte",
            "iogurte",
            False,
            170.0,
            "g",
            "",
        ),
        (
            "Biscoito de Polvilho Orgânico Crilancha Cenoura e Cúrcuma 40g",
            "cenoura",
            None,
            True,
            40.0,
            "g",
            "",
        ),
        ("Geleia Diet Morango Linea 230g", "geleia", "geleia", False, 230.0, "g", ""),
        (
            "Biscoito Recheio Cheesecake com Geleia de Frutas Vermelhas 80g",
            "geleia",
            None,
            True,
            80.0,
            "g",
            "",
        ),
        (
            "Refrigerante Limão Antarctica 2L",
            "refrigerante",
            "refrigerante",
            False,
            2000.0,
            "ml",
            "flavor should not steal",
        ),
        # ==================== SIZE PARSING VARIATIONS ====================
        (
            "Cerveja Budweiser Zero Álcool Lata 350ml",
            "cerveja",
            "cerveja",
            False,
            350.0,
            "ml",
            "",
        ),
        (
            "Papel Alumínio Wyda Pratic Rolo 7,5 X 30cm",
            "papel aluminio",
            "papel aluminio",
            False,
            7.5,
            "m",
            "roll product",
        ),
        ("Cenoura Cariorta 700g", "cenoura", "cenoura", False, 700.0, "g", ""),
        ("Ovos de Codorna Granja Loureiro 200G", "ovo", "ovo", False, 200.0, "g", ""),
        ("Salmao Defumado Fatias 100g", "salmao", "salmao", False, 100.0, "g", ""),
        (
            "Agua Sanitaria Qboa 1L",
            "agua sanitaria",
            "agua sanitaria",
            False,
            1000.0,
            "ml",
            "",
        ),
        # ==================== MORE VARIETY & EDGE CASES ====================
        (
            "Absorvente Sempre Livre Adapt 32 Un",
            "absorvente",
            "absorvente",
            False,
            32.0,
            "un",
            "",
        ),
        (
            "Enxaguante Bucal Colgate Plax 500ml",
            "enxaguante bucal",
            "enxaguante bucal",
            False,
            500.0,
            "ml",
            "",
        ),
        ("Salsicha Perdigão 500g", "salsicha", "salsicha", False, 500.0, "g", ""),
        (
            "Polvilho Azedo Yoki 500g",
            "polvilho azedo",
            "polvilho azedo",
            False,
            500.0,
            "g",
            "",
        ),
        (
            "Tomate Italiano Unidade",
            "tomate",
            "tomate",
            False,
            None,
            None,
            "variable weight",
        ),
        (
            "Vinho em Lata Rosé de Verano Ocea 269ml",
            "vinho",
            "vinho",
            False,
            269.0,
            "ml",
            "",
        ),
        (
            "Ovinhos de Amendoim Elma Chips 145g",
            "vinho",
            None,
            True,
            145.0,
            "g",
            "should not match vinho",
        ),
        (
            "Biscoito Água e Sal Tradicional 200g",
            "biscoito",
            "biscoito agua e sal",
            False,
            200.0,
            "g",
            "",
        ),
        (
            "Macarrão Instantâneo Lámen Adria Tomate 75g",
            "macarrao",
            "macarrao instantaneo",
            False,
            75.0,
            "g",
            "",
        ),
        # ==================== MORE REAL-WORLD VARIATIONS ====================
        (
            "Detergente Liquido Ype Clear 500ml",
            "detergente",
            "detergente",
            False,
            500.0,
            "ml",
            "",
        ),
        (
            "Sabonete Liquido Palmolive Melancia 250ml",
            "sabonete liquido",
            "sabonete liquido",
            False,
            250.0,
            "ml",
            "",
        ),
        ("Shampoo Clear Men 200ml", "shampoo", "shampoo", False, 200.0, "ml", ""),
        (
            "Condicionador Pantene 400ml",
            "condicionador",
            "condicionador",
            False,
            400.0,
            "ml",
            "",
        ),
        (
            "Arroz Integral Tio João 1kg",
            "arroz",
            "arroz integral",
            False,
            1000.0,
            "g",
            "",
        ),
        (
            "Feijao Carioca Tipo 1 Camil 1kg",
            "feijao",
            "feijao carioca",
            False,
            1000.0,
            "g",
            "",
        ),
        (
            "Macarrao Espaguete Barilla 500g",
            "macarrao",
            "espaguete",
            False,
            500.0,
            "g",
            "",
        ),
        (
            "Biscoito Agua e Sal Marilan 200g",
            "biscoito",
            "biscoito agua e sal",
            False,
            200.0,
            "g",
            "",
        ),
        ("Bolacha Maria Bauducco 400g", "bolacha", None, True, 400.0, "g", ""),
        # Meat cuts & poultry
        (
            "Peito de Frango Resfriado Sadia 1kg",
            "frango",
            "peito de frango",
            False,
            1000.0,
            "g",
            "",
        ),
        (
            "Sobrecoxa de Frango Congelada Perdigao 1kg",
            "sobrecoxa",
            "sobrecoxa",
            False,
            1000.0,
            "g",
            "",
        ),
        ("Alcatra Bovina Resfriada 500g", "alcatra", "alcatra", False, 500.0, "g", ""),
        ("Picanha Bovina Maturatta 1kg", "picanha", "picanha", False, 1000.0, "g", ""),
        # Cleaning & household
        (
            "Agua Sanitaria Qboa 2L",
            "agua sanitaria",
            "agua sanitaria",
            False,
            2000.0,
            "ml",
            "",
        ),
        (
            "Desinfetante Pinho Sol Original 1L",
            "desinfetante",
            "desinfetante",
            False,
            1000.0,
            "ml",
            "",
        ),
        (
            "Limpador Multiuso Veja 500ml",
            "limpador multiuso",
            "limpador multiuso",
            False,
            500.0,
            "ml",
            "",
        ),
        ("Esponja de Aço Bombril 60g", "esponja", "esponja", False, 60.0, "g", ""),
        # Pet products
        (
            "Areia Sanitária Pipicat Floral 4kg",
            "areia de gato",
            "areia de gato",
            False,
            4000.0,
            "g",
            "",
        ),
        (
            "Ração para Cães Adultos Pedigree 15kg",
            "racao de cao",
            "racao de cao",
            False,
            15000.0,
            "g",
            "",
        ),
        # Dairy & refrigerated
        ("Leite Integral Italac 1L", "leite", "leite", False, 1000.0, "ml", ""),
        ("Iogurte Natural Nestle 170g", "iogurte", "iogurte", False, 170.0, "g", ""),
        ("Queijo Minas Frescal 400g", "queijo", "queijo minas", False, 400.0, "g", ""),
        ("Manteiga Aviação 200g", "manteiga", "manteiga", False, 200.0, "g", ""),
        # Snacks & sweets
        (
            "Chocolate em Barra Lacta 100g",
            "chocolate",
            "chocolate",
            False,
            100.0,
            "g",
            "",
        ),
        (
            "Biscoito Recheado Oreo 90g",
            "biscoito recheado",
            "biscoito recheado",
            False,
            90.0,
            "g",
            "",
        ),
        ("Chiclete Trident Melancia 25g", "chiclete", "chiclete", False, 25.0, "g", ""),
        # Fruits & vegetables (variable weight)
        ("Banana Nanica Kg", "banana", "banana", False, None, None, "variable weight"),
        ("Manga Tommy Kg", "manga", "manga", False, None, None, ""),
        ("Abacaxi Perola Unidade", "abacaxi", "abacaxi", False, None, None, ""),
        # Paper & disposables
        (
            "Papel Higienico Neve 12 rolos",
            "papel higienico",
            "papel higienico",
            False,
            None,
            None,
            "",
        ),
        ("Guardanapo Folha Dupla 50un", "guardanapo", None, True, 50.0, "un", ""),
        # More flavor bleed examples
        ("Suco de Laranja Del Valle 1L", "suco", "suco", False, 1000.0, "ml", ""),
        (
            "Refrigerante Guarana Antarctica 2L",
            "refrigerante",
            "refrigerante",
            False,
            2000.0,
            "ml",
            "",
        ),
        (
            "Cereal Matinal Nesfit Morango 300g",
            "cereal",
            "cereal",
            False,
            300.0,
            "g",
            "",
        ),
        # Known tricky ones
        (
            "Creme de Leite Nestle 200g",
            "creme de leite",
            "creme de leite",
            False,
            200.0,
            "g",
            "",
        ),
        (
            "Requeijao Cremoso Catupiry 250g",
            "requeijao",
            "requeijao",
            False,
            250.0,
            "g",
            "",
        ),
        ("Margarina Qualy 250g", "margarina", "margarina", False, 250.0, "g", ""),
        # Extra volume
        ("Fosforo Fiat Lux Caixa 10", "fosforo", "fosforo", False, None, None, ""),
        (
            "Bicarbonato de Sodio Kitano 100g",
            "bicarbonato de sodio",
            "bicarbonato de sodio",
            False,
            100.0,
            "g",
            "",
        ),
        ("Cominho em Po Kitano 30g", "cominho", "cominho", False, 30.0, "g", ""),
        ("Lentilha Camil 500g", "lentilha", "lentilha", False, 500.0, "g", ""),
        ("Ervilha em Conserva Olé 170g", "ervilha", "ervilha", False, 170.0, "g", ""),
    ],
)
def test_clean_and_classify_regression_cases(
    allow_list_terms,
    name,
    term,
    expected_generic,
    expected_noise,
    expected_size,
    expected_unit,
    note,
):
    """Regression + knowledge-base tests for clean_and_classify.
    Focused on previous pain points (ovo, areia de gato, racao de gato, multi-word, flavor bleed, size).
    Expected behavior = desired v1 behavior. Failing tests are documented as known gaps."""
    result = clean_and_classify(
        name=name, term=term, allow_list_terms=allow_list_terms, db_brand=None
    )

    assert result["generic_name"] == expected_generic, (
        f"Generic mismatch on: {name} | note: {note}"
    )
    assert result["is_noise"] == expected_noise, (
        f"Noise flag wrong on: {name} | note: {note}"
    )

    if expected_size is not None:
        assert abs((result.get("package_size") or 0) - expected_size) < 0.01, (
            f"Size mismatch on: {name} | note: {note}"
        )
    else:
        assert result.get("package_size") is None, (
            f"Size should be None on: {name} | note: {note}"
        )

    assert result.get("unit") == expected_unit, (
        f"Unit mismatch on: {name} | note: {note}"
    )
