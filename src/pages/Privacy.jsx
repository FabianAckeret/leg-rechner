import React from 'react';

// Datenschutzhinweis nach revidiertem Datenschutzgesetz (DSG). Bei Änderungen am Datenfluss mitpflegen.
export default function Privacy({ go }) {
  return (
    <div className="prose">
      <div className="anim-head">
        <h1>Datenschutz</h1>
        <p className="lead">Welche Angaben der Rechner speichert, wer sie sieht und wie du sie löschst.</p>
      </div>

      <h2 className="h2">Verantwortlich</h2>
      <p>
        Fabian Ackeret, Fluhmattstrasse, 5222 Umiken. Fragen, Auskunft und Löschwünsche richtest du direkt an Fabian
        oder als Antwort auf die Nachricht, mit der du deinen persönlichen Link erhalten hast.
      </p>

      <h2 className="h2">Zweck</h2>
      <p>
        Die Angaben dienen nur dazu, gemeinsam abzuklären, ob sich eine Lokale Elektrizitätsgemeinschaft (LEG) an der
        Fluhmattstrasse lohnt. Sie werden nicht weitergegeben und nicht für etwas anderes verwendet.
      </p>

      <h2 className="h2">Welche Angaben gespeichert werden</h2>
      <ul>
        <li>Deine Adresse. Sie ist mit deinem persönlichen Link verknüpft.</li>
        <li>Ob du mitmachst, noch unsicher bist oder nicht mitmachst.</li>
        <li>Jahresverbrauch, Leistung der PV-Anlage, Wärmepumpe und E-Auto, sofern du mitmachst oder noch unsicher bist.</li>
        <li>Zeitpunkt deiner Einwilligung und der letzten Änderung.</li>
      </ul>
      <p>
        Lädst du Messdaten (CSV) hoch, gehen die Stundenwerte für die Berechnung an den Server und werden dort nicht
        gespeichert. Tarife und LEG-Einstellungen bleiben in deinem Browser, ebenso dein persönlicher Link, damit du ihn
        nicht jedes Mal neu öffnen musst.
      </p>

      <h2 className="h2">Wer was sieht</h2>
      <ul>
        <li>
          <strong>Nachbarn und alle anderen Besucher</strong> sehen nur, wie viele Häuser mitmachen, noch offen sind oder
          nicht mitmachen, und Summen über die ganze Strasse, gerundet auf 1000 kWh und 10 CHF. Echte Angaben fliessen
          erst ein, wenn mindestens drei andere Häuser mitmachen. Adressen und Werte einzelner Häuser sind nicht sichtbar.
        </li>
        <li><strong>Du</strong> siehst mit deinem Link deine eigenen Angaben und dein eigenes Ergebnis.</li>
        <li>
          <strong>Fabian Ackeret</strong> als Verantwortlicher sieht alle Angaben in der Datenbank, um die LEG abzuklären
          und Fragen zu beantworten.
        </li>
      </ul>
      <p>
        Wer deinen persönlichen Link kennt, kann die Angaben zu deinem Haus sehen und ändern. Gib ihn deshalb nicht weiter.
        Ist er in falsche Hände geraten, erhältst du von Fabian einen neuen.
      </p>

      <h2 className="h2">Wo die Daten liegen</h2>
      <ul>
        <li>
          <strong>Datenbank und Berechnung:</strong> Supabase (Supabase Inc., USA), Rechenzentrum in Zürich. Supabase
          protokolliert technische Zugriffsdaten wie die IP-Adresse.
        </li>
        <li>
          <strong>Webseite:</strong> GitHub Pages (GitHub Inc., USA). GitHub protokolliert beim Aufruf der Seite ebenfalls
          die IP-Adresse.
        </li>
      </ul>

      <h2 className="h2">Wie lange</h2>
      <p>
        Bis die Nachbarschaft über die LEG entschieden hat, spätestens bis am 31. Dezember 2027. Danach werden alle
        Angaben gelöscht.
      </p>

      <h2 className="h2">Deine Rechte</h2>
      <p>
        Du kannst deine Angaben jederzeit selbst ändern oder mit <strong>Meine Angaben löschen</strong> im{' '}
        <button className="link" onClick={() => go('rechner')}>Rechner</button> entfernen. Damit ziehst du auch deine
        Einwilligung zurück. Auskunft und alles Weitere erhältst du bei Fabian.
      </p>
    </div>
  );
}
