import React from 'react'
import styled from 'styled-components'

// Controlled star rating component (1-5)
// Props:
// - name: unique string per rating group
// - value: selected value (number 1..5 or 0/undefined)
// - onChange: (val:number) => void
const StarRating = ({ name, value = 0, onChange }) => {
  const ids = [5,4,3,2,1].map(v => `${name}-star${v}`)
  return (
    <StyledWrapper>
      <div className="rating">
        {[5,4,3,2,1].map((v, idx) => (
          <React.Fragment key={v}>
            <input
              type="radio"
              id={ids[idx]}
              name={name}
              value={v}
              checked={Number(value) === v}
              onChange={() => onChange && onChange(v)}
            />
            <label htmlFor={ids[idx]} title={`${v} star${v>1?'s':''}`}>
              <svg viewBox="0 0 576 512" height="1em" xmlns="http://www.w3.org/2000/svg" className="star-solid">
                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
              </svg>
            </label>
          </React.Fragment>
        ))}
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  .rating { display: inline-block; }
  .rating:not(:checked) > input { position: absolute; appearance: none; }
  .rating:not(:checked) > label { float: right; cursor: pointer; font-size: 30px; fill: #666; }
  .rating:not(:checked) > label > svg { fill: #666; transition: fill 0.2s ease; }
  .rating > input:checked + label:hover,
  .rating > input:checked + label:hover ~ label,
  .rating > input:checked ~ label:hover,
  .rating > input:checked ~ label:hover ~ label,
  .rating > label:hover ~ input:checked ~ label { fill: #e58e09; }
  .rating:not(:checked) > label:hover,
  .rating:not(:checked) > label:hover ~ label { fill: #ff9e0b; }
  .rating > input:checked ~ label > svg { fill: #ffa723; }
`

export default StarRating

