//
// proxy_test.go
// FreeTurn Admin — run.args manipulation
//

package admin

import (
	"reflect"
	"testing"
)

func TestSetConnectArg(t *testing.T) {
	cases := []struct {
		name string
		args []string
		hp   string
		want []string
	}{
		{
			"replace existing",
			[]string{"-listen", "0.0.0.0:55555", "-connect", "10.10.20.1:51820", "-debug"},
			"10.10.30.1:25083",
			[]string{"-listen", "0.0.0.0:55555", "-connect", "10.10.30.1:25083", "-debug"},
		},
		{
			"append when missing",
			[]string{"-listen", "0.0.0.0:55555", "-debug"},
			"10.10.30.1:25083",
			[]string{"-listen", "0.0.0.0:55555", "-debug", "-connect", "10.10.30.1:25083"},
		},
		{
			"empty args",
			[]string{},
			"127.0.0.1:51820",
			[]string{"-connect", "127.0.0.1:51820"},
		},
		{
			"same value keeps order",
			[]string{"-connect", "127.0.0.1:51820", "-debug"},
			"127.0.0.1:51820",
			[]string{"-connect", "127.0.0.1:51820", "-debug"},
		},
	}
	for _, c := range cases {
		if got := setConnectArg(c.args, c.hp); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: setConnectArg(%v, %q) = %v, want %v", c.name, c.args, c.hp, got, c.want)
		}
	}
}
