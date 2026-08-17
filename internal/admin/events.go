//
// events.go
// FreeTurn Admin
// Release 1.0.0 
//
// In-app event journal (/config/events.json),
// capped at 500 entries (same schema as before).
//

package admin

import (
	"encoding/json"
	"os"
	"time"
)

const MaxEvents = 500

type Event struct {
	Time    string `json:"time"`
	Source  string `json:"source"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func readEvents() []Event {
	data, err := os.ReadFile(EventsFile)
	if err != nil {
		return []Event{}
	}
	var events []Event
	if err := json.Unmarshal(data, &events); err != nil {
		return []Event{}
	}
	return events
}

func writeEvents(events []Event) {
	if len(events) > MaxEvents {
		events = events[len(events)-MaxEvents:]
	}
	data, err := json.MarshalIndent(events, "", "  ")
	if err != nil {
		return
	}
	_ = writeFileAtomic(EventsFile, data, 0o644)
}

func LogEvent(source, eventType, message string, details ...any) {
	event := Event{
		Time:    time.Now().UTC().Format("2006-01-02T15:04:05.000000Z"),
		Source:  source,
		Type:    eventType,
		Message: message,
	}
	if len(details) > 0 {
		event.Details = details[0]
	}
	events := readEvents()
	events = append(events, event)
	writeEvents(events)
}

func GetEvents(limit int) []Event {
	if limit <= 0 {
		limit = 100
	}
	events := readEvents()
	if len(events) == 0 {
		return []Event{}
	}
	if len(events) > limit {
		events = events[len(events)-limit:]
	}
	// newest first
	out := make([]Event, 0, len(events))
	for i := len(events) - 1; i >= 0; i-- {
		out = append(out, events[i])
	}
	return out
}
