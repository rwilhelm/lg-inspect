/*** @jsx React.DOM */

var Path = React.createClass({
  getDefaultProps: function() {
    return {width: 2};
  },
  render: function() {
    return (
      <path width={this.props.width} className={this.props.className} clip-path={this.props.clipPath} d={this.props.data} />
    );
  }
});