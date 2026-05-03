# Helmáč Koňference 2026

Minimalistická webová aplikace pro zobrazení harmonogramu a jednoduché přihlašování účastníků. Aplikace využívá "Systém důvěry" bez hesel a e-mailů pro rychlé fungování na menších akcích. Vytvořena pro nasazení jako statická stránka (GitHub Pages) s využitím bezplatné vrstvy Supabase pro ukládání dat.

## 1. Jak upravovat program
Program konference se nachází v souboru `schedule.json` v kořenovém adresáři. 
Stačí soubor otevřít a upravit JSON strukturu. Každá událost musí mít unikátní `id`. Změny se projeví ihned po nahrání na server (žádný build není potřeba).

## 2. Nasazení na GitHub Pages
1. Nahrajte celý obsah této složky do svého GitHub repozitáře.
2. Soubor `js/config.js` by měl být přidán do `.gitignore`, aby vaše klíče nebyly veřejné. (Jelikož využíváme veřejnou tabulku s daty, klíče v prohlížeči vidět budou, ale tímto chráníme kód v repozitáři pro dobrou praxi).
3. V repozitáři přejděte do **Settings > Pages**.
4. V sekci "Build and deployment" nastavte Source na **Deploy from a branch**.
5. Vyberte větev `main` a složku `/ (root)` a klikněte na **Save**.
6. Aplikace bude dostupná na `https://vase-jmeno.github.io/nazev-repa/`.

## 3. Nastavení Supabase (Databáze)

1. Založte si projekt zdarma na [Supabase.com](https://supabase.com).
2. Přejděte do **SQL Editor** a spusťte následující kód pro vytvoření tabulek:

```sql
-- Vytvoření tabulky uživatelů
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vytvoření tabulky přihlášek
CREATE TABLE public.signups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, event_id)
);

-- Povolit veřejný přístup pro aplikaci
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Povolit vše všem uživatelům (Users)" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Povolit vše všem přihláškám (Signups)" ON public.signups FOR ALL USING (true) WITH CHECK (true);
```

3. V postranním panelu Supabase klikněte na ikonu ozubeného kola (**Project Settings**), přejděte na **API** a zkopírujte:
   - **Project URL**
   - **Project API keys (anon / public)**
4. Vytvořte soubor `js/config.js` podle vzoru `js/config.example.js` a vložte do něj tyto údaje.

Hotovo! Aplikace je plně připravena k provozu. Žádné další nastavování e-mailů nebo serverů není potřeba.
